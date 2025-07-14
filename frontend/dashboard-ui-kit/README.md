# Dashboard UI Kit

This is a React UI kit extracted from the LecturaLM project, containing the Dashboard and NotebookDetail pages with their visual components.

## Features

- **Dashboard Page**: Displays notebooks in a grid layout with creation modal
- **NotebookDetail Page**: Shows document management, preview, and chat interface
- **Dark/Light Theme**: Toggle between themes with persistence
- **Responsive Design**: Works on desktop and mobile devices
- **Mock Data**: Pre-populated with sample data for demonstration

## Components Included

### Pages
- `Dashboard.tsx` - Main dashboard with notebook grid
- `NotebookDetail.tsx` - Detailed notebook view with document management

### Components
- `Header.tsx` - Navigation header with theme toggle
- `NotebookCard.tsx` - Individual notebook card component
- `CreateNotebookModal.tsx` - Modal for creating new notebooks

### Context
- `ThemeContext.tsx` - Theme management (dark/light mode)
- `AuthContext.tsx` - Mock authentication context

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`

## Usage Notes

- This is a **UI-only** implementation with mock data
- All functionality is simulated for demonstration purposes
- Backend integration points are clearly marked for your implementation
- Components use Tailwind CSS for styling
- Icons are provided by Lucide React

## Customization

You can easily customize:
- Colors in `tailwind.config.js`
- Mock data in the page components
- Add your own API integration by replacing mock functions

## File Structure

```
src/
├── pages/
│   ├── Dashboard.tsx
│   └── NotebookDetail.tsx
├── components/
│   ├── Layout/
│   │   └── Header.tsx
│   └── Dashboard/
│       ├── NotebookCard.tsx
│       └── CreateNotebookModal.tsx
├── contexts/
│   ├── ThemeContext.tsx
│   └── AuthContext.tsx
├── types/
│   └── index.ts
├── App.tsx
├── main.tsx
└── index.css
```

## Technologies Used

- React 18
- TypeScript
- React Router DOM
- Tailwind CSS
- Lucide React (icons)
- Vite (build tool) 