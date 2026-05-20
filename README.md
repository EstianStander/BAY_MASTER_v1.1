# BayMaster

BayMaster is a simple shop-floor tracker for six work bays. It lets a team see what each bay is working on, who is assigned, and the planned start/end times. It also keeps a history of finished work, supports quick direct jobs that temporarily displace a bay project, and stores photos for bay and direct work (entry, progress, exit/delivery). There is also an equipment intake list with photos and checkout status.

## Project Structure

```
BAY_Master/
├── public/              # Static files
│   ├── css/            # Stylesheets
│   ├── js/             # Client-side JavaScript
│   ├── photos/         # Photo assets
│   └── Assets/         # General assets
├── views/              # HTML pages
│   ├── index.html      # Home page
│   ├── bay1.html       # Bay 1 page
│   ├── bay2.html       # Bay 2 page
│   ├── bay3.html       # Bay 3 page
│   ├── bay4.html       # Bay 4 page
│   ├── bay5.html       # Bay 5 page
│   └── bay6.html       # Bay 6 page
├── routes/             # Route definitions
├── controllers/        # Business logic
├── models/             # Data models
├── middleware/         # Custom middleware
├── config/             # Configuration files
├── utils/              # Utility functions
├── server.js           # Main server file
└── package.json        # Dependencies

```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. For development with auto-reload:
```bash
npm run dev
```

## Features

- Modular file architecture
- Sidebar navigation
- 6 bay management pages
- Technician preplanner page with calendar
- Responsive design
- Easy to extend and maintain

## Usage

Access the application at `http://localhost:3000`

Navigate between bays using the sidebar or the bay cards on the home page.

## How the equipment page is built (simple)

- The page layout is plain HTML in [views/equipment.html](views/equipment.html) with a form at the top, a live list of items in the workshop, and a history list underneath.
- Styling comes from shared classes in [public/css/styles.css](public/css/styles.css) for cards, grids, modals, and the upload dropzone.
- The browser logic lives in [public/js/equipment.js](public/js/equipment.js). It loads items, renders cards, handles the form submit, shows photo previews, and opens the detail/history modals.
- Data is stored in MongoDB using the schema in [models/EquipmentModel.js](models/EquipmentModel.js).
- The backend endpoints are in [routes/api/equipment.js](routes/api/equipment.js). They list items, save new bookings with image uploads, and mark items as checked out.
- Uploaded photos are saved to the configured equipment upload folder and the API stores the public URLs for display.

### Configurable media storage paths

You can control where media is stored by setting these environment variables:

- `PROJECT_IMAGES_DIR` (default: `public/project-images`)
- `EQUIPMENT_UPLOADS_DIR` (default: `public/uploads/equipment`)
- `VISITOR_SIGNATURES_DIR` (default: `public/uploads/visitors`)

You can also change the public URL paths served by Express:

- `PROJECT_IMAGES_URL_PATH` (default: `/project-images`)
- `EQUIPMENT_UPLOADS_URL_PATH` (default: `/uploads/equipment`)
- `VISITOR_SIGNATURES_URL_PATH` (default: `/uploads/visitors`)

If you provide relative paths for storage directories, they are resolved from the project root.

## Endpoints

### Web pages

- `GET /` Home page
- `GET /bay1` to `GET /bay6` Bay pages
- `GET /manage` Management page
- `GET /delays` Delays page
- `GET /finished-projects` Finished projects page
- `GET /equipment` Equipment intake page
- `GET /job-costing` Job costing sheet page
- `GET /preplanner` Project preplanner page
- `GET /mobile` Mobile view
- `GET /gallery` Media gallery

### API

#### Bays

- `GET /api/bays` List all bays (6 slots, missing bays are `null`)
- `GET /api/bays/:bayNumber` Get a single bay
- `POST /api/bays/:bayNumber` Create or update a bay
- `POST /api/bays/:bayNumber/pause` Pause or unpause a bay (`action: "pause" | "unpause"`, optional `reason`)
- `POST /api/bays/:bayNumber/finish` Finish a bay project and archive it (optional `projectNotes` array)
- `DELETE /api/bays/:bayNumber` Clear a bay

#### Direct projects

- `GET /api/direct-projects` List direct projects
- `POST /api/direct-projects` Create a direct project and displace the current bay project
- `POST /api/direct-projects/:id/pause` Pause or unpause a direct project (`action: "pause" | "unpause"`)
- `POST /api/direct-projects/:id/finish` Finish a direct project and restore the displaced bay project
- `PATCH /api/direct-projects/:id` Update direct project fields

#### Finished projects

- `GET /api/finished-projects` List finished projects (most recent first)

#### Technicians

- `GET /api/technicians` List technicians (auto-seeds on first request)

#### Equipment

- `GET /api/equipment` List equipment items
- `GET /api/equipment?equipmentId=ABC123` Look up a single equipment item by ID (case-insensitive)
- `POST /api/equipment` Create an equipment item with optional photo upload (multipart form, `photos` field)
- `DELETE /api/equipment/:id` Mark an item as checked out (no hard delete)

#### Job costing

- `GET /api/job-costing/projects` List linkable project options from bays, direct projects, and finished projects
- `GET /api/job-costing` List saved job costing sheets
- `GET /api/job-costing/:id` Get one job costing sheet
- `POST /api/job-costing` Create a job costing sheet
- `PUT /api/job-costing/:id` Update a job costing sheet
- `DELETE /api/job-costing/:id` Delete a job costing sheet

Job costing uses a dedicated MongoDB connection and should point at the shared InductoTrack database/collection:

- `JOBS_MONGODB_URI` (or `MONGODB_URI`) = `mongodb+srv://stormfoxstudi_db_user:WjZLMVHXEpfSdtAU@inductotrackdb.q5ekljf.mongodb.net/`
- `JOBS_DB_NAME` (or `MONGODB_DATABASE`) = `InductoTrackDb`
- Collection = `Jobs`

#### Preplanned projects

- `GET /api/preplanned-projects` List preplanned projects (optional `from` and `to` date query)
- `GET /api/preplanned-projects/:id` Get one preplanned project
- `POST /api/preplanned-projects` Create a preplanned project
- `PUT /api/preplanned-projects/:id` Update a preplanned project
- `DELETE /api/preplanned-projects/:id` Delete a preplanned project

### Media and data helpers

- `GET /alerts` Returns an empty alerts list (JSON stub)
- `GET /data` Fallback bay data used by the frontend
- `POST /upload-photo/bay1` to `POST /upload-photo/bay6` Upload bay media (multipart)
- `POST /upload-photo/direct` Upload direct project media (multipart)
- `GET /project-images-structure` Returns available media grouped by bay/direct
- `POST /download-media` Download selected media as a zip
