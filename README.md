# OPAL Appointments

A modern Progressive Web App (PWA) for appointment scheduling at Opal nail salon.

## Features

- 📅 **Calendar View**: Easy date selection with business hours
- 👥 **Employee Scheduling**: Manage appointments for multiple employees
- 🔄 **Real-time Sync**: Firebase integration for multi-device synchronization
- 📱 **PWA Support**: Install on mobile devices like a native app
- 🌐 **Multi-language**: Supports Greek language interface

## Tech Stack

- **Frontend**: React 19 + Vite
- **UI Framework**: Mantine
- **Database**: Firebase Firestore
- **Routing**: React Router
- **Date Handling**: Day.js
- **Deployment**: Netlify

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd OPAL
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase:
   - Create a Firebase project at https://console.firebase.google.com/
   - Enable Firestore Database
   - Update `src/firebase.js` with your Firebase configuration

4. Start development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Deployment

The app is configured for automatic deployment on Netlify:

1. Connect your Git repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy automatically on push to main branch

## Business Hours

- **Tuesday-Thursday**: 10:00 - 21:00
- **Friday**: 09:00 - 21:00  
- **Saturday**: 09:00 - 15:00
- **Sunday-Monday**: Closed

## Project Structure

```
src/
├── components/          # React components
├── services/           # Firebase services
├── firebase.js         # Firebase configuration
└── main.jsx           # App entry point

public/
├── icons/             # PWA icons
├── manifest.json      # PWA manifest
└── sw.js             # Service worker
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Private project for OPAL nail salon.
