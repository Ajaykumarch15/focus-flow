const { google } = require('googleapis');
const { logger } = require('./logger');
const User = require('../models/User');

// IES-P1-24 · per-user single-flight token refresh.
//
// A burst of concurrent Drive operations (project folder creation racing a
// worklog doc create, N parallel worklog syncs) used to call
// `refreshAccessToken()` once per request — each hitting Google and each
// persisting its own token metadata. The Map below keys an in-flight refresh by
// user id, so only the first caller performs the refresh; every concurrent
// caller awaits the same promise and then applies the refreshed tokens to its
// own client. The entry is always removed on settle, so a later request refreshes
// again once the token is near expiry (rotation still works as in IES-P0-10).
const refreshPromises = new Map();

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Persist the drive-sync error flag for a user. Done as a targeted `$set` (not
// `user.save()`) so it can never clobber token metadata that a concurrent
// request may have just rotated. Best-effort: a failed flag write only logs.
async function setDriveError(user, message) {
  if (!user || !user._id) return;
  try {
    await User.updateOne({ _id: user._id }, { $set: { driveSyncError: String(message).slice(0, 500) } });
  } catch (err) {
    logger.warn('Failed to persist drive sync error flag');
  }
}

async function clearDriveError(user) {
  if (!user || !user._id) return;
  try {
    await User.updateOne({ _id: user._id }, { $set: { driveSyncError: '' } });
  } catch (err) {
    logger.warn('Failed to clear drive sync error flag');
  }
}

/**
 * Refreshes the user's Google access token once, persists the rotated tokens
 * (IES-P0-10), and returns the updated token metadata so every single-flight
 * waiter can rebuild its own OAuth2 client. On failure the connection is
 * disconnected (as before) and the drive-sync error flag is surfaced.
 */
async function refreshAndPersist(user) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.googleTokens.accessToken,
    refresh_token: user.googleTokens.refreshToken,
    expiry_date: user.googleTokens.expiryDate,
  });

  try {
    logger.debug('Refreshing Google access token');
    const { credentials } = await oauth2Client.refreshAccessToken();

    user.googleTokens.accessToken = credentials.access_token;
    // IES-P0-10: refresh-token rotation — Google issues a NEW refresh token on
    // each refresh; persist it so an old (revoked) one is never reused.
    if (credentials.refresh_token) {
      user.googleTokens.refreshToken = credentials.refresh_token;
    }
    if (credentials.expiry_date) {
      user.googleTokens.expiryDate = credentials.expiry_date;
    } else if (credentials.expires_in) {
      user.googleTokens.expiryDate = Date.now() + (credentials.expires_in * 1000);
    } else {
      user.googleTokens.expiryDate = Date.now() + (3600 * 1000); // default 1 hour
    }
    user.driveSyncError = ''; // IES-P1-24: a successful refresh clears any prior failure.
    user.markModified('googleTokens');
    await user.save();
    logger.debug('Google access token refreshed and stored');

    return {
      accessToken: user.googleTokens.accessToken,
      refreshToken: user.googleTokens.refreshToken,
      expiryDate: user.googleTokens.expiryDate,
    };
  } catch (err) {
    logger.warn('Failed to refresh Google access token');
    // Automatically disconnect Google Drive to prevent repeat errors and loops,
    // and surface the failure to the client so the user can reconnect.
    user.googleConnected = false;
    user.googleTokens = undefined;
    user.driveSyncError = 'Google connection has expired. Please reconnect in settings.';
    user.markModified('googleTokens');
    await user.save();
    throw new Error('Google connection has expired. Please reconnect in settings.');
  }
}

/**
 * Returns an authorized OAuth2 client. If the access token is close to expiry or expired,
 * it refreshes the token (deduplicated per user) and saves the new token metadata
 * back to the user model.
 */
async function getAuthorizedClient(user) {
  if (!user.googleTokens || !user.googleTokens.refreshToken) {
    throw new Error('Google Drive account is not connected');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.googleTokens.accessToken,
    refresh_token: user.googleTokens.refreshToken,
    expiry_date: user.googleTokens.expiryDate,
  });

  // Check if token is expired or close to it (1 minute margin)
  if (!user.googleTokens.expiryDate || Date.now() < user.googleTokens.expiryDate - 60000) {
    return oauth2Client;
  }

  const userId = String(user._id);
  let inFlight = refreshPromises.get(userId);
  if (!inFlight) {
    inFlight = refreshAndPersist(user);
    refreshPromises.set(userId, inFlight);
    // `.then(cleanup, cleanup)` (not `.finally()`) so a failed refresh never
    // leaves an unhandled rejection on the cleanup promise.
    const cleanup = () => {
      if (refreshPromises.get(userId) === inFlight) refreshPromises.delete(userId);
    };
    inFlight.then(cleanup, cleanup);
  }

  const updated = await inFlight;

  // Apply the single-flight refresh result to THIS caller's client, so even a
  // caller whose loaded user doc predates the rotation gets the fresh tokens.
  oauth2Client.setCredentials({
    access_token: updated.accessToken,
    refresh_token: updated.refreshToken,
    expiry_date: updated.expiryDate,
  });

  return oauth2Client;
}

/**
 * Creates a project folder under Google Drive root, and sets up 4 subfolders:
 * - WorkLogs
 * - Design Docs
 * - Meeting Notes
 * - Reports
 * 
 * Returns the folder IDs mapping.
 */
async function createProjectFolders(oauth2Client, projectName) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  logger.debug('Creating Google Drive folder structure');

  // 1. Create main project folder
  const projectMetadata = {
    name: projectName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  const projectFolderRes = await drive.files.create({
    requestBody: projectMetadata,
    fields: 'id',
  });
  const googleFolderId = projectFolderRes.data.id;

  // 2. Create subfolders
  const subfolders = ['WorkLogs', 'Design Docs', 'Meeting Notes', 'Reports'];
  const folderIds = { googleFolderId };

  for (const name of subfolders) {
    const subMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [googleFolderId],
    };
    const subFolderRes = await drive.files.create({
      requestBody: subMetadata,
      fields: 'id',
    });

    const key = name.charAt(0).toLowerCase() + name.slice(1).replace(' ', '') + 'FolderId';
    folderIds[key] = subFolderRes.data.id;
  }

  logger.debug('Google Drive folder structure created');
  return folderIds;
}

/**
 * Formats the WorkLog journal template text.
 */
function generateWorkLogTemplate(title, projectName, fields = {}) {
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let text = `=========================================
📝 FOCUSFLOW WORKLOG JOURNAL
=========================================
Project:     ${projectName}
WorkLog:     ${title}
Created At:  ${dateStr}
=========================================

-----------------------------------------
🎯 Problem Statement
-----------------------------------------
${fields.problem || 'Define the core problem or goal here...'}

-----------------------------------------
💡 Plan / Solution Outline
-----------------------------------------
${fields.plan || 'Outline the steps or architectural updates proposed...'}

-----------------------------------------
🛠️ Design Notes & Decisions
-----------------------------------------
${fields.designNotes || 'Add architecture decisions, code snippets, and research notes here...'}

-----------------------------------------
🚧 Current Work / Implementation Logs
-----------------------------------------
${fields.currentWork || '- Day 1: Initiated work log'}

-----------------------------------------
🛑 Blockers & Issues
-----------------------------------------
${fields.blockers || 'None listed.'}
`;

  if (fields.completedItems && fields.completedItems.length > 0) {
    text += `
-----------------------------------------
✅ Completed Items
-----------------------------------------
`;
    fields.completedItems.forEach(item => {
      text += `[${item.done ? 'x' : ' '}] ${item.text}\n`;
    });
  }

  if (fields.links && fields.links.length > 0) {
    text += `
-----------------------------------------
🔗 Links & Resources
-----------------------------------------
`;
    fields.links.forEach(link => {
      text += `- ${link.label}: ${link.url}\n`;
    });
  }

  return text;
}

/**
 * Creates a Google Document inside the specified parent folder and populates it with a structured template.
 * Returns the created document's ID and web URL.
 */
async function createWorkLogDoc(oauth2Client, folderId, title, projectName, initialFields = {}) {
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  logger.debug('Creating Google Document');

  // 1. Create file inside parent folder
  const fileMetadata = {
    name: title,
    mimeType: 'application/vnd.google-apps.document',
    parents: [folderId],
  };

  const fileRes = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id, webViewLink',
  });

  const googleDocId = fileRes.data.id;
  const googleDocUrl = fileRes.data.webViewLink;

  // 2. Populate Document with template using Google Docs API
  try {
    const docs = google.docs({ version: 'v1', auth: oauth2Client });
    const templateText = generateWorkLogTemplate(title, projectName, initialFields);

    await docs.documents.batchUpdate({
      documentId: googleDocId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: templateText,
            },
          },
        ],
      },
    });
    logger.debug('Google Document populated with starter template');
  } catch (err) {
    logger.warn('Failed to populate doc starter text');
    // Document is still created, so we don't crash, just log and continue
  }

  return { googleDocId, googleDocUrl };
}

/**
 * Updates an existing Google Document with the latest fields, replacing the entire content.
 */
async function updateWorkLogDoc(oauth2Client, googleDocId, title, projectName, fields = {}) {
  try {
    const docs = google.docs({ version: 'v1', auth: oauth2Client });
    
    // 1. Get current document content to know the end index
    const doc = await docs.documents.get({ documentId: googleDocId });
    const content = doc.data.body.content;
    const lastElement = content[content.length - 1];
    const endIndex = lastElement.endIndex;

    const templateText = generateWorkLogTemplate(title, projectName, fields);

    // 2. Clear old content and insert new content
    const requests = [];
    if (endIndex > 2) {
      requests.push({
        deleteContentRange: {
          range: {
            startIndex: 1,
            endIndex: endIndex - 1,
          },
        },
      });
    }
    requests.push({
      insertText: {
        location: { index: 1 },
        text: templateText,
      },
    });

    await docs.documents.batchUpdate({
      documentId: googleDocId,
      requestBody: { requests },
    });
    logger.debug('Google Document updated');
  } catch (err) {
    // IES-P1-24: rethrow so the caller can surface the failure (driveSyncError)
    // instead of this degrading silently. The worklog patch still succeeded
    // locally — the caller treats Drive as best-effort.
    logger.warn('Failed to update Google Document');
    throw err;
  }
}

module.exports = {
  getOAuth2Client,
  getAuthorizedClient,
  createProjectFolders,
  createWorkLogDoc,
  updateWorkLogDoc,
  setDriveError,
  clearDriveError,
};
