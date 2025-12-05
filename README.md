# PAHUWAII :3
For a student overwhelmed by numerous backlogs everyday, creating a to-do list may seem too stimulating and daunting. Pahuwaii aims to be a to-do list that is easy to the eyes and accommodating to students that are easily overstimulated. 

> [!IMPORTANT]
> ###### How to Run the Web App:   
> Run the node.js file (in terminal via command ```node server.js```)  
> click the link provided (http://localhost:3000)  

## Tech Stack:
a) **Frontend** - HTML, CSS (+Tailwind), JavaScript  
b) **Backend** - Node.js + Express &emsp; : Javascript all throughout   
c) **Database** - Sqlite &emsp; &emsp; &emsp; &emsp; &emsp; : easier learing curve and one file only    

## File Breakdown
### 1. index.html - *The skeleton of the code*
```
    Links to external resources:
        TailwindCSS      (for styling)
        Google Fonts     (for handwritten style hehe :3)
        Material Symbols (for icons)
        CSS              (pahuwaii.css)
        JS               (pahuwaii.js)
    DOM elements:
        Top bar (title + profile button)
        Main kanban board with 3 columns (to do, in progress, done)
        Progress bar that updates as tasks are completed
        Modals (popups) for adding, editing, deleting tasks
        Undo banner for restoring recently deleted tasks
```
### 2. pahuwaii.css - *The Design (not covered in Tailwind)*
```
        Resetting default styles (removing margins, setting background, fonts)
        Scroll handling:  Kanban columns scroll vertically but hide the scrollbar
        Undo banner:      Initially hidden, styled to appear at the bottom when active
```
### 3. pahuwaii.js - *The Functionality*
```
    State Management: 
        Keeps track of all tasks (allTasks), currently edited task, last deleted task (for undo)
    Rendering:
        Fetches tasks from the server (loadTasks())
        Sorts tasks (date, due date, priority)
        Renders them into kanban columns (renderBoard() and renderColumn())
        Updates the progress bar
    Task Operations:
        Add (via POST request)
        Edit (PATCH request)
        Delete (DELETE request, with undo option)
        Update fields inline (due date, status, priority)
    UI Interaction:
        Open/close modals
        Show/hide undo banner
        Save sorting preference to localStorage
```
### 4. server.js - *Access and Manipulation of Database (with pahuwaii.js)*
```
    Database setup:
        Uses sqlite3 to create a tasks table (if it doesn't exist yet)
        Table has fields like id, name, due_date, due_time, priority, status, deleted_at
    API endpoints:
        GET /tasks → Returns all non-deleted tasks
        POST /tasks → Adds a new task
        PATCH /tasks/:id → Updates fields of a task
        DELETE /tasks/:id → Soft deletes a task (marks deleted_at timestamp)
        POST /tasks/:id/undo → Restores a soft-deleted task
    Middleware:
        Uses express.json() to parse JSON request bodies
        Uses cors() so frontend can communicate without cross-origin issues
```

## Database Attributes
1) id - unique id for each task (incremental)
2) name 
3) due_date 
4) due_time
5) priority (do now, do next, do later, do last)
6) status (to do, in progress, done)
7) date_added (for sorting)
8) deleted_at - for soft deletes (since we have an undo feature)

## How it works:
1) User opens the app  
    &emsp; a) browser loads index.html  
    &emsp; b) that file links pahuwaii.css (styling) and pahuwaii.js (logic)  
    &emsp; c) initial task load  
    &emsp; d) when pahuwaii.js runs, it calls loadTasks()  
    &emsp; e) then it sends a GET /tasks request to server.js  
    &emsp; f) server.js queries the SQLite database and returns a JSON array of tasks  
    &emsp; g) pahuwaii.js then calls renderBoard() to display tasks in the correct columns   

3) Adding a task  
    &emsp; a) user opens the “Add Task” modal (frontend only)  
    &emsp; b) on submit, JS sends a POST /tasks request to the backend with { name, due_date, due_time, priority, status }  
    &emsp; c) server.js inserts the new row into SQLite  
    &emsp; d) JS reloads tasks by calling loadTasks()  

4) Editing a task  
    &emsp; a) user clicks edit  
    &emsp; b) modal opens with task details pre-filled from allTasks  
    &emsp; c) on submit, JS sends a PATCH /tasks/:id with the updated fields  
    &emsp; d) server.js updates SQLite  
    &emsp; e) JS reloads tasks  

5) Updating inline fields (ex: user changes priority from dropdown)  
    &emsp; a) triggers updateTaskField()  
    &emsp; b) sends PATCH /tasks/:id with { priority: "do later" }  
    &emsp; c) server updates SQLite and frontend reloads tasks  
    
6) Deleting + Undo  
    &emsp; a) user clicks delete, JS shows confirmation modal  
    &emsp; b) on confirm, JS calls DELETE /tasks/:id  
    &emsp; c) server.js soft deletes the task by setting deleted_at to not null  
    &emsp; d) JS shows Undo banner  
    &emsp; e) if Undo is clicked, JS calls POST /tasks/:id/undo, server sets deleted_at to null, frontend reloads tasks  


## Features to improve on:
- tasks with long names (string overflow)
- colors for the priority dropdown (tailwind dropdown colors)
- when you uncheck the checkbox, it always goes back to 'to do', not considering its previous status
- drag to change status


# Deployment

1) Frontend
2) Backend 
