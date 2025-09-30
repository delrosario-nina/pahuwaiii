PAHUWAII :3

For a student overwhelmed by numerous backlogs everyday, creating a to-do list may seem too stimulating and daunting. Pahuwaii aims to be a to-do list that is easy to the eyes and accommodating to students that are easily overstimulated. 

Tech Stack:
    a) Frontend - HTML, CSS (+tailwind), JavaScript
    b) Backend - Node.js + Express                          : javascript all throughout 
    c) Database - Sqlite                                    : easier learing curve and one file only

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

What is inside the database?
1) id - unique id for each task (incremental)
2) name 
3) due_date 
4) due_time
5) priority (do now, do next, do later, do last)
6) status (to do, in progress, done)
7) date_added (for sorting)
8) deleted_at - for soft deletes (since we have an undo feature)

How it works:
1) User opens the app
    browser loads index.html.
    that file links pahuwaii.css (styling) and pahuwaii.js (logic).
    initial task load
    when pahuwaii.js runs, it calls loadTasks().
    then it sends a GET /tasks request to server.js.
    server.js queries the SQLite database and returns a JSON array of tasks.
    pahuwaii.js then calls renderBoard() to display tasks in the correct columns.

2) Adding a task
    user opens the “Add Task” modal (frontend only).
    on submit, JS sends a POST /tasks request to the backend with { name, due_date, due_time, priority, status }.
    server.js inserts the new row into SQLite.
    JS reloads tasks by calling loadTasks().

3) Editing a task
    user clicks edit.
    modal opens with task details pre-filled from allTasks.
    on submit, JS sends a PATCH /tasks/:id with the updated fields. 
    server.js updates SQLite.
    JS reloads tasks.

4) Updating inline fields (ex: user changes priority from dropdown)
    triggers updateTaskField().
    sends PATCH /tasks/:id with { priority: "do later" }.
    server updates SQLite and frontend reloads tasks.
    
5) Deleting + Undo
    user clicks delete, JS shows confirmation modal.
    on confirm, JS calls DELETE /tasks/:id.
    server.js soft deletes the task by setting deleted_at to not null
    JS shows Undo banner.
    if Undo is clicked, JS calls POST /tasks/:id/undo, server sets deleted_at to null, frontend reloads tasks.

6) Dark mode toggle
    clicking the title toggles the .dark-mode class on <body>.
    pahuwaii.css applies dark theme styles automatically.


Features to improve on:
- tasks with long names (ga-overflow sya rn)
- night mode
- colors for the priority dropdown (tailwind dropdown colors)
- when you uncheck the checkbox, it always goes back to 'to do', not considering its previous status
- drag to change status


Lab 2
- account creation (sign-up)
    - username and email
    - password
    - question and answer for password recovery (who is the cutest pokemon of all time)
    - name of user 
        - max of 20 characters
    - security back-up question
    -
