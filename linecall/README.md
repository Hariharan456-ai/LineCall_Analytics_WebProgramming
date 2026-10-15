# LineCall Analytics
Ball-tracking dashboard for tennis: IN/OUT line calls, challenge review, match analytics.
Stack: HTML5, CSS3, JavaScript (canvas), PHP + SQLite, Bootstrap 5, React 18.

## Run
    cd linecall
    php -S localhost:8000
Open http://localhost:8000 (needs PHP 8+ with pdo_sqlite enabled).
No PHP? Open index.html with VS Code Live Server: runs in demo mode (browser storage).

## Structure
- js/court.js   court geometry, IN/OUT decision logic, sample data generator
- js/app.jsx    React app: dashboard, court map, challenge review, log form, routing
- api.php       REST API + SQLite database
- css/style.css custom theme
