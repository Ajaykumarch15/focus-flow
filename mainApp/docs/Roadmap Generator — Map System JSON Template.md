# Roadmap Generator — Map System JSON Template

This JSON is the input sent to the Roadmap Generator / Map System.

The system uses this input to automatically generate:

- Roadmap
- Phases
- Milestones
- Tasks
- Subtasks
- Task categories
- Priorities
- Dependencies
- Start dates
- Due dates
- Estimated hours
- Completion criteria
- Warnings
- Roadmap statistics

---

## JSON Template

```json
{
  "project": {
    "name": "Project or Roadmap Name",
    "description": "Short description of what this roadmap should achieve",
    "startDate": "YYYY-MM-DD",
    "deadline": "YYYY-MM-DD"
  },

  "schedule": {
    "workingDays": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ],
    "hoursPerDay": 3,
    "bufferDays": 2
  },

  "rules": {
    "includeRevision": true,
    "includePractice": true,
    "includeProjects": true,
    "includeQuiz": true,
    "includeSubtasks": true,
    "defaultSubtaskCount": 2,
    "defaultTaskHours": 1.5,
    "milestoneGroupSize": 4
  },

  "phases": [
    {
      "name": "Phase 1 Name",
      "description": "What this phase should accomplish",

      "topics": [
        {
          "title": "Topic 1",
          "estimatedHours": 2,
          "priority": "medium",
          "subtopics": [
            "Subtopic 1",
            "Subtopic 2",
            "Subtopic 3"
          ]
        },

        {
          "title": "Topic 2",
          "estimatedHours": 3,
          "priority": "high",
          "subtopics": [
            "Subtopic 1",
            "Subtopic 2"
          ]
        }
      ]
    },

    {
      "name": "Phase 2 Name",
      "description": "What this phase should accomplish",

      "topics": [
        {
          "title": "Topic 1",
          "estimatedHours": 2,
          "priority": "medium",
          "subtopics": []
        },

        {
          "title": "Topic 2",
          "estimatedHours": 2.5,
          "priority": "low",
          "subtopics": []
        }
      ]
    }
  ]
}
```

---

# Field Explanation

## 1. Project

```json
"project": {
  "name": "string",
  "description": "string",
  "startDate": "YYYY-MM-DD",
  "deadline": "YYYY-MM-DD"
}
```

### `name`

Required.

The name of the roadmap.

Example:

```json
"name": "Full Stack Web Development"
```

### `description`

Optional.

Explains the overall goal.

Example:

```json
"description": "Learn frontend and backend development and build a full-stack application."
```

### `startDate`

Required.

The date from which the roadmap should start.

The date can be:

- Today
- A future date

Example:

```json
"startDate": "2026-09-15"
```

The system should **not** use the database creation date as the roadmap start date.

If the roadmap is created on September 12 but:

```json
"startDate": "2026-09-20"
```

the first task should be scheduled from September 20.

If the selected date is not a working day, the scheduler should move the first task to the next available working day.

### `deadline`

Required.

The final target date of the roadmap.

Example:

```json
"deadline": "2026-11-30"
```

The deadline must be after the start date.

---

# 2. Schedule

```json
"schedule": {
  "workingDays": [],
  "hoursPerDay": 3,
  "bufferDays": 2
}
```

### `workingDays`

Defines which days the user is available.

Example:

```json
"workingDays": [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday"
]
```

A user can also work all seven days:

```json
"workingDays": [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
]
```

### `hoursPerDay`

Maximum planned work capacity per working day.

Example:

```json
"hoursPerDay": 3
```

Allowed range:

```text
0.5 → 12 hours
```

### `bufferDays`

Number of days reserved before the final deadline.

Example:

```json
"bufferDays": 2
```

If:

```text
Deadline = November 30
Buffer = 2 days
```

the scheduler should attempt to complete the generated workload before the buffer period.

---

# 3. Rules

```json
"rules": {
  "includeRevision": true,
  "includePractice": true,
  "includeProjects": true,
  "includeQuiz": true,
  "includeSubtasks": true,
  "defaultSubtaskCount": 2,
  "defaultTaskHours": 1.5,
  "milestoneGroupSize": 4
}
```

### `includeRevision`

Controls whether revision tasks are automatically generated.

```json
"includeRevision": true
```

### `includePractice`

Controls whether practice tasks are generated for topics.

```json
"includePractice": true
```

### `includeProjects`

Controls whether a mini-project is generated for each phase.

```json
"includeProjects": true
```

### `includeQuiz`

Controls whether milestone quizzes are generated.

```json
"includeQuiz": true
```

### `includeSubtasks`

Controls automatic subtask generation.

```json
"includeSubtasks": true
```

### `defaultSubtaskCount`

Number of subtasks generated when a topic doesn't provide its own subtopics.

Example:

```json
"defaultSubtaskCount": 2
```

### `defaultTaskHours`

Fallback duration when a topic does not specify `estimatedHours`.

Example:

```json
"defaultTaskHours": 1.5
```

### `milestoneGroupSize`

Maximum number of topics grouped into one milestone.

Example:

```json
"milestoneGroupSize": 4
```

---

# 4. Phases

A roadmap must contain at least one phase.

```json
"phases": [
  {
    "name": "Frontend Development",
    "description": "Learn frontend technologies",
    "topics": []
  }
]
```

Each phase contains topics.

---

# 5. Topics

Each topic represents a major learning/work item.

```json
{
  "title": "React Hooks",
  "estimatedHours": 3,
  "priority": "high",
  "subtopics": [
    "useState",
    "useEffect",
    "useContext",
    "useReducer"
  ]
}
```

### `title`

Required.

Example:

```json
"title": "React Hooks"
```

### `estimatedHours`

Optional.

If omitted, the system uses:

```text
rules.defaultTaskHours
```

Example:

```json
"estimatedHours": 3
```

### `priority`

Allowed values:

```text
low
medium
high
urgent
```

Example:

```json
"priority": "high"
```

### `subtopics`

Optional.

If provided, each subtopic becomes a generated subtask.

Example:

```json
"subtopics": [
  "useState",
  "useEffect",
  "useContext"
]
```

If no subtopics are provided and:

```json
"includeSubtasks": true
```

the system automatically generates the configured number of subtasks.

---

# Complete Example

```json
{
  "project": {
    "name": "MERN Stack Development",
    "description": "Learn MERN stack and build a production-ready full-stack application.",
    "startDate": "2026-09-15",
    "deadline": "2026-11-30"
  },

  "schedule": {
    "workingDays": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ],
    "hoursPerDay": 3,
    "bufferDays": 2
  },

  "rules": {
    "includeRevision": true,
    "includePractice": true,
    "includeProjects": true,
    "includeQuiz": true,
    "includeSubtasks": true,
    "defaultSubtaskCount": 2,
    "defaultTaskHours": 1.5,
    "milestoneGroupSize": 4
  },

  "phases": [
    {
      "name": "React Development",
      "description": "Learn React fundamentals and build interactive interfaces.",

      "topics": [
        {
          "title": "React Fundamentals",
          "estimatedHours": 3,
          "priority": "high",
          "subtopics": [
            "Components",
            "JSX",
            "Props",
            "State"
          ]
        },

        {
          "title": "React Hooks",
          "estimatedHours": 4,
          "priority": "high",
          "subtopics": [
            "useState",
            "useEffect",
            "useContext",
            "useReducer"
          ]
        },

        {
          "title": "React Routing",
          "estimatedHours": 2,
          "priority": "medium",
          "subtopics": [
            "React Router",
            "Routes",
            "Navigation"
          ]
        },

        {
          "title": "State Management",
          "estimatedHours": 3,
          "priority": "medium",
          "subtopics": [
            "Context API",
            "Redux",
            "Redux Toolkit"
          ]
        }
      ]
    },

    {
      "name": "Node.js Backend",
      "description": "Build backend APIs using Node.js and Express.",

      "topics": [
        {
          "title": "Node.js Fundamentals",
          "estimatedHours": 3,
          "priority": "high",
          "subtopics": [
            "Modules",
            "File System",
            "Events",
            "HTTP"
          ]
        },

        {
          "title": "Express.js",
          "estimatedHours": 3,
          "priority": "high",
          "subtopics": [
            "Routing",
            "Middleware",
            "Controllers",
            "Error Handling"
          ]
        },

        {
          "title": "REST APIs",
          "estimatedHours": 3,
          "priority": "high",
          "subtopics": [
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "HTTP Status Codes"
          ]
        }
      ]
    },

    {
      "name": "MongoDB",
      "description": "Learn MongoDB and integrate it with the backend.",

      "topics": [
        {
          "title": "MongoDB Fundamentals",
          "estimatedHours": 3,
          "priority": "medium",
          "subtopics": [
            "Documents",
            "Collections",
            "CRUD Operations"
          ]
        },

        {
          "title": "MongoDB with Node.js",
          "estimatedHours": 3,
          "priority": "high",
          "subtopics": [
            "MongoDB Driver",
            "Mongoose",
            "Schemas",
            "Models"
          ]
        }
      ]
    }
  ]
}
```

---

# How the Map System Uses This

The Map System should transform:

```text
Project
   ↓
Phases
   ↓
Topics
   ↓
Milestone grouping
   ↓
Learning tasks
Practice tasks
Quiz tasks
Revision tasks
Project tasks
Review tasks
   ↓
Dependencies
   ↓
Scheduling
   ↓
Dates
   ↓
Capacity analysis
   ↓
Warnings
   ↓
Generated Roadmap
```

The input JSON **does not need to contain**:

```text
task IDs
milestone IDs
task dates
phase dates
dependencies
roadmap statistics
utilization
task categories
generated timestamps
```

Those are generated by the Map System.

---

# Minimal JSON

For a simple roadmap, the user can provide only:

```json
{
  "project": {
    "name": "Learn JavaScript",
    "startDate": "2026-09-15",
    "deadline": "2026-10-15"
  },

  "schedule": {
    "workingDays": [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday"
    ],
    "hoursPerDay": 2
  },

  "phases": [
    {
      "name": "JavaScript Fundamentals",
      "topics": [
        {
          "title": "Variables and Data Types"
        },
        {
          "title": "Functions"
        },
        {
          "title": "Arrays"
        },
        {
          "title": "Objects"
        }
      ]
    }
  ]
}
```

The system should fill the missing optional values using defaults.
```

This is the **input contract** I would give to the Map System. It matches the finalized V2 structure while keeping generated fields out of the request payload.

If your goal is to give this to an **AI agent that constructs the JSON automatically**, I would additionally create a second version specifically containing **strict instructions + JSON schema + examples + rules for how the agent should decide phases/topics/hours**.