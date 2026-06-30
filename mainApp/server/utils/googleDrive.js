const { google } = require('googleapis');

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Returns an authorized OAuth2 client. If the access token is close to expiry or expired,
 * it refreshes the token manually and saves the new token metadata back to the user model.
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
  if (user.googleTokens.expiryDate && Date.now() >= user.googleTokens.expiryDate - 60000) {
    try {
      console.log(`🔄 Refreshing Google access token for user ${user.email}...`);
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      user.googleTokens.accessToken = credentials.access_token;
      if (credentials.expiry_date) {
        user.googleTokens.expiryDate = credentials.expiry_date;
      } else if (credentials.expires_in) {
        user.googleTokens.expiryDate = Date.now() + (credentials.expires_in * 1000);
      } else {
        user.googleTokens.expiryDate = Date.now() + (3600 * 1000); // default 1 hour
      }
      user.markModified('googleTokens');
      await user.save();

      // update credentials in local client
      oauth2Client.setCredentials({
        access_token: user.googleTokens.accessToken,
        refresh_token: user.googleTokens.refreshToken,
        expiry_date: user.googleTokens.expiryDate,
      });
      console.log('✅ Access token successfully refreshed and stored.');
    } catch (err) {
      console.error('❌ Failed to refresh Google access token:', err);
      // Automatically disconnect Google Drive to prevent repeat errors and loops
      user.googleConnected = false;
      user.googleTokens = undefined;
      await user.save();
      throw new Error('Google connection has expired. Please reconnect in settings.');
    }
  }

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

  console.log(`📁 Creating Google Drive folder structure for project: "${projectName}"`);

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

  console.log('✅ Google Drive folder structure created successfully:', folderIds);
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

  console.log(`📄 Creating Google Document: "${title}" inside folder: ${folderId}`);

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
    console.log('✅ Google Document populated with starter template.');
  } catch (err) {
    console.error('⚠️ Failed to populate doc starter text:', err);
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
    console.log(`✅ Google Document ${googleDocId} updated successfully.`);
  } catch (err) {
    console.error(`⚠️ Failed to update Google Document ${googleDocId}:`, err.message);
  }
}

module.exports = {
  getOAuth2Client,
  getAuthorizedClient,
  createProjectFolders,
  createWorkLogDoc,
  updateWorkLogDoc,
};
