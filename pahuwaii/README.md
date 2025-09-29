PAHUWAII :3

For a student overwhelmed by numerous backlogs everyday, creating a to-do list may seem too stimulating and daunting. Pahuwaii aims to be a to-do list that is easy to the eyes and accommodating to students that are easily overstimulated. 

Tech Stack:
    a) Frontend - HTML, CSS (+tailwind), JavaScript
    b) Backend - Node.js + Express
    c) Database - Sqlite

How to run the web app: Run the node.js file (using the command node server.js) and then click the link provided (http://locahlhost:3000)

Breakdown of each file

1) index.html - the skeleton of the code
    What's inside?
    Links to external resources:
        TailwindCSS (for styling),
        Google Fonts (for handwritten style hehe :3),
        Material Symbols (for icons),
        CSS (pahuwaii.css) and JS (pahuwaii.js).

    DOM elements:
        Top bar (title + profile button).
        Main kanban board with 3 columns (to do, in progress, done).
        Progress bar that updates as tasks are completed.
        Modals (popups) for adding, editing, deleting tasks.
        Undo banner for restoring recently deleted tasks.
2) pahuwaii.css - the design (not covered in tailwind)
    What's inside?
        Resetting default styles (removing margins, setting background, fonts).
        Scroll handling: Kanban columns scroll vertically but hide the scrollbar.
        Undo banner: Initially hidden, styled to appear at the bottom when active.
        Dark mode styles: Overrides background colors, border colors, text colors, and input styles when the .dark-mode class is applied to body
    
3) pahuwaii.js - the functionality of the app
    What's inside and what does it do?
    State management: 
        Keeps track of all tasks (allTasks), currently edited task, last deleted task (for undo).
    Rendering:
        Fetches tasks from the server (loadTasks()).
        Sorts tasks (date, due date, priority).
        Renders them into kanban columns (renderBoard() and renderColumn()).
        Updates the progress bar.
    Task operations:
        Add (via POST request).
        Edit (PATCH request).
        Delete (DELETE request, with undo option).
        Update fields inline (due date, status, priority).
    UI interaction:
        Open/close modals.
        Toggle dark mode by clicking the title.
        Show/hide undo banner.
        Save sorting preference to localStorage.

4) server.js - communicates with pahuwaii.js to access and manipulate the database
    What's inside and what does it do?
    Database setup:
        Uses sqlite3 to create a tasks table (if not exists).
        Table has fields like id, name, due_date, due_time, priority, status, deleted_at.
    API endpoints:
        GET /tasks → Returns all non-deleted tasks.
        POST /tasks → Adds a new task.
        PATCH /tasks/:id → Updates fields of a task.
        DELETE /tasks/:id → Soft deletes a task (marks deleted_at timestamp).
        POST /tasks/:id/undo → Restores a soft-deleted task.
    Middleware:
        Uses express.json() to parse JSON request bodies.
        Uses cors() so frontend can communicate without cross-origin issues.




features to improve on:
- tasks with long names (ga-overflow sya rn)