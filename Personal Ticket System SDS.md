# Software Requirements Specification
## For {{Personal Ticket System (PTS)}}

## Table of Contents
* [1. Introduction](#1-introduction)
    * [1.1 Document Purpose](#11-document-purpose)
    * [1.2 Product Scope](#12-product-scope)
    * [1.3 Definitions, Acronyms, and Abbreviations](#13-definitions-acronyms-and-abbreviations)
    * [1.4 References](#14-references)
    * [1.5 Document Overview](#15-document-overview)
* [2. Product Overview](#2-product-overview)
    * [2.1 Product Perspective](#21-product-perspective)
    * [2.2 Product Functions](#22-product-functions)
    * [2.3 Product Constraints](#23-product-constraints)
    * [2.4 User Characteristics](#24-user-characteristics)
    * [2.5 Assumptions and Dependencies](#25-assumptions-and-dependencies)
    * [2.6 Apportioning of Requirements](#26-apportioning-of-requirements)
* [3. Requirements](#3-requirements)
    * [3.1 External Interfaces](#31-external-interfaces)
    * [3.2 Functional](#32-functional)
    * [3.3 Quality of Service](#33-quality-of-service)
    * [3.4 Compliance](#34-compliance)
    * [3.5 Design and Implementation](#35-design-and-implementation)
    * [3.6 AI/ML](#36-aiml)

## 1. Introduction
The personal ticket system (PTS) is a system in which tickets for daily activities (wash car, clean floors, do laundry) are either manually or automatically on a reoccurring basis. The tickets are then added to a FIFO queue in which is it sorted by oldest to newest, with additional sort weighting depending on the priority, deadline, number of skips, and estimated amount of effort for the tasks. This acts to make the selection and completion tasks less effortful and require less cognitive load and reduce selection fatigue.

### 1.1 Document Purpose
This document has been created so that an AI agent can "vibe code" the application from scratch. Use this document to inform the design and development of the application, but do not be afraid to add additional QOL features.

### 1.2 Product Scope
This application has the primary purpose of allowing users to add new tickets to a queue, and having the system, using a combination of factors and FIFO to determine which ticket to serve from the queue when they are completing the queue.

This is divided into 3 primary systems
1. Allow users to add tickets to the queue either through the app or by email
2. Allow users to be served individual tickets from the queue to be completed or skipped by the user
3. Allow the user to maintain open tickets by showing them a list and allowing them to edit, reopen, or close any ticket in the system with the ability to filter or sort tickets in the list.

All of these functions serve to allow the performance of CRUD operations on tickets by the user. Tickets, in this case, are the primary entity the system keeps track of.


#### Tickets Definition

##### Schema
Tickets consist of the following fields
- ID
- Title
- Status
- Date Created
- Description
- related tickets
- Due Date
- Priority
- Est Hours
- Number of skips

ID is some automatically generated number that iterates in order.

Title is a required plaintext field that is a brief summary of the ticket.

Status is a dropdown field that shows the status of the ticket. The possible values are ["open", "in-progress", "completed", "skipped"]

Date created is auto populated calendar date the ticket was created in mm/dd/yyyy format. 

Description is an optional large plain text field used to describe the ticket (markdown formatting).

Related tickets is an optional comma separated list of selectable tickets the user can select from. There can be multiple related tickets.

Due date is an optional calendar date field.

Priority is an optional dropdown field which shows the priority which has the possible values ["very low", "low", "default", "high", "very high"]. All tickets created should be "default" priority when created.

Est hours is the float number of hours estimated to complete the task. Can be decimal up to 2 decimal places, eg 0.50, 0.15, 0.25, 1.

Number of skips is the automatically iterating int number of times a user has "skipped" a task. This will always start at 0 and will go up automatically on user skips.

##### UI
There are multiple pages where the user can interact with tickets. 

- On the home page, a create ticket button should be visible.
- There should be a ticket management page where users can click on tickets
- There should be a ticket form where you can view an individual ticket and manage it's fields. You can get to this screen by clicking on a row in the ticket management screen, which will load an existing ticket, or by clicking new ticket from the homebage which will show a blank ticket with a new generated ID.
- There should be a ticket in progress screen that will show the top ticket in the queue and allow the user to either complete or skip the ticket, both of which will then load the next ticket in the queue, the skip button will change the status of the ticket to "skipped" and move it to the back of the queue (with adjustments for weighting), the complete button will change the status of the ticket to "completed" and remove the ticket from the queue.

#### System 1: Ticket Creation

Tickets can be created in 3 ways:
1. Through a "add ticket" button within the application
2. Through an email being sent to an email address
3. Through an automated reoccurring ticket creation task which automatically fires on a schedule.

When the add ticket button is clicked, it should show the user the ticket screen with a blank ticket and all automatically populated fields populated with their respective default values.

When an email is sent to the inbox, it will create a blank ticket with all automatically populated fields populated with their respective default values. In addition, the subject of the email will be used to fill the "title" field of the ticket, and the body of the email should be used to populate the description of the ticket. If the body of the email contains HTML or images, the images should be stripped and the HTML tags should be stripped with only the plaintext being used to populate the description, with the exception that markdown content should be kept and not stripped.

When an automatic reoccurring ticket creation document is fired, create a new ticket with a new ID, but with all fields from the sample reocurring ticket being added to the newly created ticket.

Whenever whenever a ticket does not have a "completed" status, if it is not already in the queue, it should be added to the queue.


#### System 2: Work on and complete tickets

On the ticket completion screen, the last ticket in the queue should be loaded and displayed to the user (sorted with FIFO and weighted fields). There should also be two buttons at the bottom, "complete" and "skip", as described the ticket ui section.

#### System 3: Reoccurring Ticket Screen
From the home page you should be able to get to the reoccurring ticket page. On this page, the user will be able to see current reoccurring ticket templates and a create reoccurring ticket button. Clicking on an existing reoccurring ticket template, it will show a screen just like the ticket screen, exception with the additional "active" checkbox and all additional fields that involve changing the frequency in which the tickets should file. It should allow you to automatically create tickets daily, weekly, and monthly, and how many of each entity, such as every 2 weeks or every 3 months, it should also allow you to select a start date for the template which it will use to fire relative to that date.


### 1.3 Definitions, Acronyms, and Abbreviations

| Term |       Definition       |
|------|------------------------|
| PTS  | Personal Ticket System |
| FIFO | First In First Out     |
| QOL  | Quality Of Life        |

### 1.4 References

| Title | Owner | Version | Type |
|-------|-------|---------|------|
| [Next.js Documentation](https://nextjs.org/docs) | Vercel | 14.x | Informative |
| [FastAPI Documentation](https://fastapi.tiangolo.com/) | Sebastián Ramírez | 0.110+ | Informative |
| [MySQL 8.0 Reference Manual](https://dev.mysql.com/doc/refman/8.0/en/) | Oracle | 8.0 | Informative |
| [Docker Compose Specification](https://docs.docker.com/compose/compose-file/) | Docker, Inc. | 3.8+ | Normative |

### 1.5 Document Overview
This document is organized into three major sections:

1. **Introduction (Section 1)** — Provides context, scope, and definitions for the PTS project.
2. **Product Overview (Section 2)** — Describes the system from a high level, including its functions, constraints, users, and assumptions.
3. **Requirements (Section 3)** — Details the functional and non-functional requirements including external interfaces, quality of service, compliance, design constraints, and AI/ML considerations.

## 2. Product Overview
<!-- background and context that shape the product's requirements -->

### 2.1 Product Perspective
PTS is a new, standalone personal productivity application. It is not a replacement for or extension of an existing system. It draws inspiration from project management tools (e.g., Jira, Trello) but is purpose-built for individual use with a focus on reducing decision fatigue through automated task queuing. The system integrates with an external email server for ticket creation via email and runs entirely within a Docker-based environment on the user's machine or a personal server.

### 2.2 Product Functions
- **Ticket CRUD** — Create, read, update, and delete tickets with all defined schema fields.
- **Weighted FIFO Queue** — Automatically sort and serve tickets based on creation date, priority, due date, skip count, and estimated effort.
- **Ticket Completion Flow** — Present the next ticket in the queue and allow the user to complete or skip it.
- **Ticket Management List** — View, filter, and sort all tickets in the system with the ability to edit, reopen, or close any ticket.
- **Email-Based Ticket Creation** — Receive emails at a designated address and automatically create tickets from the subject and body.
- **Recurring Ticket Templates** — Define templates that automatically generate new tickets on a daily, weekly, or monthly schedule.
- **Ticket Relationships** — Link related tickets together for context and traceability.

### 2.3 Product Constraints
- The application is a responsive web application optimized for both desktop and mobile browsers. It is not a native mobile app, but the UI must be fully functional and usable on mobile screen sizes.
- The application must run in Docker containers as defined in Section 3.1.3.
- The tech stack is constrained to Next.js (frontend), FastAPI (backend), and MySQL (database).
- The application is designed for single-user use; multi-user authentication and authorization are out of scope.
- Email-based ticket creation depends on the availability and configuration of an email server container.
- The system must function offline once the Docker containers are running (no external cloud dependencies at runtime beyond email ingestion).

### 2.4 User Characteristics
| Characteristic | Description |
|----------------|-------------|
| User Class | Single individual user (the system owner) |
| Technical Expertise | Comfortable running Docker and basic terminal commands for setup; no technical expertise required for day-to-day use |
| Frequency of Use | Daily — the system is intended to be used as a daily task management tool |
| Access Level | Full administrative access to all features |
| Accessibility | Standard web accessibility best practices should be followed (keyboard navigation, semantic HTML, sufficient contrast) |

### 2.5 Assumptions and Dependencies
| Assumption / Dependency | Impact if Invalid |
|--------------------------|-------------------|
| Docker and Docker Compose are installed on the host machine | Application cannot be deployed or run |
| The user has a stable local network for accessing the web UI | UI is inaccessible; ticket queue stalls |
| An SMTP-compatible email server is available (self-hosted or external) | Email-based ticket creation is unavailable; manual and recurring creation still function |
| MySQL 8.0+ is used as the database engine | Schema or query incompatibilities may arise with other versions |
| The user interacts with the system via a modern web browser (Chrome, Firefox, Edge, Safari) | UI may not render correctly on legacy browsers |
| The host machine has sufficient resources to run 2–3 Docker containers simultaneously | Performance degradation or container failures |

### 2.6 Apportioning of Requirements

| Phase | Scope | Key Deliverables |
|-------|-------|------------------|
| **Phase 1 — Core** | Ticket CRUD, weighted FIFO queue, ticket completion flow, ticket management list | Backend API, database schema, core UI pages (Home, Ticket Form, Ticket List, Queue view), Docker Compose setup |
| **Phase 2 — Recurring** | Recurring ticket templates, scheduled auto-creation | Recurring ticket UI, scheduler service, template management |
| **Phase 3 — Email** | Email-based ticket creation | Email server container, email parsing service, HTML/image stripping logic |
| **Phase 4 — Polish** | QOL improvements, accessibility, edge case handling | UI refinements, error handling, performance tuning |

## 3. Requirements
<!-- identifiable, verifiable, testable requirements; avoid implementation details -->

### 3.1 External Interfaces
<!-- inputs/outputs (formats, protocols, timing, etc); reference interface schemas where available. -->

#### 3.1.1 User Interfaces

The application consists of the following screens, all rendered as web pages in the browser:

| Screen | Purpose | Key Elements |
|--------|---------|--------------|
| **Home** | Landing page and navigation hub | "Create Ticket" button, "Work Queue" button, navigation links to Ticket Management and Recurring Tickets |
| **Ticket Form** | Create or edit a single ticket | Form fields for all ticket schema attributes (see Section 1.2), Save/Cancel buttons. When creating: blank form with defaults. When editing: pre-populated with existing data. |
| **Ticket Management List** | Browse and manage all tickets | Sortable/filterable table of all tickets showing key fields (ID, Title, Status, Priority, Due Date). Clicking a row navigates to the Ticket Form for that ticket. |
| **Queue / In-Progress** | Work through the ticket queue | Displays the top-priority ticket from the weighted FIFO queue. "Complete" and "Skip" buttons at the bottom. Completing or skipping loads the next ticket. |
| **Recurring Tickets List** | Manage recurring ticket templates | Table of existing templates with an "Active" indicator. "Create Recurring Ticket" button. Clicking a row opens the Recurring Ticket Form. |
| **Recurring Ticket Form** | Create or edit a recurring ticket template | Same fields as the Ticket Form plus: "Active" checkbox, frequency (daily/weekly/monthly), interval count (e.g., every N days/weeks/months), and start date. |

**Navigation**: A persistent navigation bar or sidebar should be present on all pages, providing links to Home, Ticket Management, Queue, and Recurring Tickets.

**Responsive Design**: The application shall be a responsive web app optimized for both desktop and mobile viewports. All screens must be fully functional on mobile devices (minimum 320px width). On mobile, the navigation should collapse into a hamburger menu or bottom navigation bar. Tables should adapt to narrow screens (e.g., horizontal scrolling or card-based layouts). Touch targets (buttons, links) should meet a minimum size of 44x44px for usability on touchscreens.

#### 3.1.3 Software Interfaces
<!-- integrations with other systems (APIs, contracts, owner, etc) -->
The application should be run with Docker where the API and Frontend are run in one docker container called "App", and the database should use a second container called "DB" and potentially a third container for an email server, if deemed nescisary.

The stack should consist of a Next.js, fastAPI, and MySql, with additional needed container and services such as redis or nginx as needed.

### 3.2 Functions

#### 3.2.1 Ticket Creation
| ID | Requirement |
|----|-------------|
| F-TC-01 | The system shall allow the user to create a new ticket via the "Create Ticket" button on the Home page. |
| F-TC-02 | New tickets shall be assigned an auto-incrementing integer ID. |
| F-TC-03 | New tickets shall default to "open" status, "default" priority, 0 skips, and the current date as the creation date. |
| F-TC-04 | The system shall accept inbound emails and create tickets where the email subject maps to the ticket title and the email body maps to the description. |
| F-TC-05 | When processing email bodies, the system shall strip HTML tags and embedded images, preserving only plaintext and markdown content. |
| F-TC-06 | Any ticket without a "completed" status that is not already in the queue shall be automatically added to the queue. |

#### 3.2.2 Ticket Queue and Completion
| ID | Requirement |
|----|-------------|
| F-QC-01 | The queue shall sort tickets using a weighted FIFO algorithm considering: creation date (oldest first), priority (higher priority first), due date (sooner first), number of skips (more skips = higher weight), and estimated hours (lower effort first). |
| F-QC-02 | The Queue screen shall display the top ticket from the weighted queue. |
| F-QC-03 | Clicking "Complete" shall set the ticket status to "completed" and remove it from the queue, then load the next ticket. |
| F-QC-04 | Clicking "Skip" shall set the ticket status to "skipped", increment the skip count by 1, move the ticket toward the back of the queue (adjusted by weighting), and load the next ticket. |
| F-QC-05 | If the queue is empty, the Queue screen shall display a message indicating there are no tickets to work on. |

#### 3.2.3 Ticket Management
| ID | Requirement |
|----|-------------|
| F-TM-01 | The Ticket Management screen shall display all tickets in a tabular format with columns for ID, Title, Status, Priority, Due Date, and Est Hours. |
| F-TM-02 | The user shall be able to sort the table by any column. |
| F-TM-03 | The user shall be able to filter tickets by status and priority. |
| F-TM-04 | Clicking a ticket row shall navigate to the Ticket Form pre-populated with that ticket's data. |
| F-TM-05 | The user shall be able to edit any field, reopen a completed ticket (setting status back to "open"), or close/delete a ticket from the Ticket Form. |

#### 3.2.4 Recurring Tickets
| ID | Requirement |
|----|-------------|
| F-RT-01 | The user shall be able to create recurring ticket templates with all standard ticket fields plus: active flag, frequency (daily/weekly/monthly), interval count, and start date. |
| F-RT-02 | When an active recurring template fires, the system shall create a new ticket with a new ID and all field values copied from the template. |
| F-RT-03 | The recurrence schedule shall be calculated relative to the template's start date (e.g., every 2 weeks from start date). |
| F-RT-04 | The user shall be able to activate or deactivate a recurring template at any time. |
| F-RT-05 | The Recurring Tickets screen shall list all templates with their active status, frequency, and next scheduled fire date. |

### 3.3 Quality of Service
<!-- measurable non-functional attributes section -->

#### 3.3.1 Performance
| Metric | Target |
|--------|--------|
| API response time (CRUD operations) | < 200ms for 95th percentile |
| Page load time (initial) | < 2 seconds |
| Page navigation (client-side) | < 500ms |
| Queue sort/calculation | < 100ms for up to 10,000 tickets |
| Database storage | MySQL volume should support at least 100,000 tickets without performance degradation |
| Container memory footprint | App container < 512MB, DB container < 512MB |

#### 3.3.2 Security
- The application is single-user and runs locally or on a private server; multi-user authentication is out of scope.
- The MySQL database shall not be exposed on public network interfaces; it should only be accessible from within the Docker network.
- API endpoints should validate and sanitize all input to prevent SQL injection and XSS attacks.
- If the application is exposed beyond localhost, a reverse proxy with HTTPS (e.g., via nginx) should be configured.
- Email ingestion should sanitize all content before storing it in the database to prevent stored XSS.

#### 3.3.3 Reliability
- The system shall gracefully handle database connection failures and display user-friendly error messages.
- Recurring ticket creation jobs shall be idempotent — if a job fires twice for the same scheduled interval, it shall not create duplicate tickets.
- The queue calculation shall produce deterministic results given the same input data.

#### 3.3.4 Availability
- The system is a personal tool and does not require an SLA.
- Docker containers should be configured with `restart: unless-stopped` to automatically recover from crashes.
- Database data shall be persisted via a Docker volume so that data survives container restarts and rebuilds.

#### 3.3.5 Observability
- The FastAPI backend shall log all API requests and errors to stdout/stderr (viewable via `docker logs`).
- The recurring ticket scheduler shall log each template fire event, including the template ID and the newly created ticket ID.
- The email ingestion service shall log each received email and whether a ticket was successfully created from it.

### 3.4 Compliance
- No regulatory compliance requirements apply — this is a personal-use application that does not process third-party personal data, financial transactions, or health records.
- The application should follow standard web accessibility guidelines (WCAG 2.1 Level A) as a best practice.

### 3.5 Design and Implementation
<!-- constraints and mandates on design, deployment, and maintenance section -->

#### 3.5.1 Installation
- **Prerequisites**: Docker and Docker Compose installed on the host machine.
- **Setup**: A single `docker-compose up -d` command shall build and start all containers (App, DB, and email server if applicable). No additional configuration or `.env` file is required.
- **Configuration**: All default environment variables (database credentials, service URLs, etc.) are baked into the `docker-compose.yml` with auto-generated values. No manual configuration is needed for first-time setup.
- **Database Initialization**: On first startup, the application shall automatically run database migrations to create the required schema.
- **Supported Platforms**: Any OS capable of running Docker (Windows, macOS, Linux).

#### 3.5.2 Build and Delivery
- The project shall use a `Dockerfile` for the App container (multi-stage build for Next.js frontend and FastAPI backend) and the official MySQL image for the DB container.
- Frontend dependencies shall be managed via `package.json` / `npm` or `yarn`.
- Backend dependencies shall be managed via `requirements.txt` or `pyproject.toml` / `pip`.
- The project shall be version-controlled in Git with a clear branching strategy (main branch is always deployable).

#### 3.5.3 Distribution
- The application is deployed as a set of Docker containers on a single host machine.
- No distributed or multi-node topology is required.
- The database runs in its own container with a persistent Docker volume for data storage.
- The App container communicates with the DB container over an internal Docker network.

#### 3.5.4 Maintainability
- The frontend and backend shall be organized into clearly separated directories within the project (e.g., `/frontend`, `/backend`).
- The backend shall follow a layered architecture: routes/controllers, services/business logic, and data access/models.
- The frontend shall use a component-based structure with reusable UI components.
- Database schema changes shall be managed through versioned migration files.
- Code should follow consistent formatting (e.g., Prettier for JS/TS, Black for Python).

#### 3.5.5 Reusability
- The ticket form component shall be reusable for both creating and editing tickets.
- The recurring ticket form shall extend the ticket form with additional scheduling fields.
- API data validation schemas (Pydantic models) shall be shared between request validation and response serialization.

#### 3.5.6 Portability
- The Docker-based deployment ensures the application runs identically on any platform that supports Docker (Windows, macOS, Linux).
- No host-specific file paths or OS-specific dependencies shall be used within the application code.
- The application could be deployed to a cloud VM, a NAS, or a Raspberry Pi without modification.

#### 3.5.7 Cost
- The application shall use only free, open-source software (Next.js, FastAPI, MySQL Community Edition).
- No paid cloud services or licensed software are required.
- If an external email provider is used instead of a self-hosted email server, the user is responsible for any associated costs.

#### 3.5.8 Deadline
- No hard deadline. The project is developed incrementally following the phased approach in Section 2.6.

#### 3.5.9 Proof of Concept
- **Objective**: Validate that the weighted FIFO queue logic produces intuitive and useful ticket ordering.
- **Scope**: Implement the core ticket CRUD and queue system (Phase 1) with a minimal UI.
- **Success Criteria**: The user can create tickets, work through the queue, and the ordering feels natural and reduces decision fatigue compared to an unordered list.

#### 3.5.10 Change Management
- All changes shall be tracked via Git commits with descriptive messages.
- Feature work should be done on feature branches and merged into main via pull requests (even for single-user development, to maintain history).
- Database schema changes require a migration file — direct schema modifications in production are not permitted.

### 3.6 AI/ML
<!-- ML-specific requirements section -->

#### 3.6.1 Model Specification
No AI/ML models are required for the initial implementation. The queue weighting algorithm is deterministic and rule-based. Future iterations could explore ML-based priority suggestions or effort estimation, but this is out of scope.

#### 3.6.2 Data Management
Not applicable — no training data or ML datasets are used.

#### 3.6.3 Guardrails
Not applicable — no AI/ML models are deployed.

#### 3.6.4 Ethics
Not applicable — no AI/ML models are deployed.

#### 3.6.5 Human-in-the-Loop
Not applicable — no AI/ML models are deployed. The user retains full control over all ticket operations (create, edit, complete, skip, delete).

#### 3.6.6 Model Lifecycle and Operations
Not applicable — no AI/ML models are deployed.