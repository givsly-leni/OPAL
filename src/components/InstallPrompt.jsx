import { useState, useEffect } from 'react';
import { Button, Paper, Text, Group, Stack } from '@mantine/core';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event so it can be triggered later
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      console.log('PWA was installed');
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <Paper 
      p="md" 
      radius="lg" 
      withBorder 
      shadow="sm"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'linear-gradient(135deg, #ffffff, #fff8fc)',
        border: '1px solid rgba(214, 51, 108, 0.25)',
        maxWidth: '350px',
        width: 'calc(100vw - 40px)'
      }}
    >
      <Stack gap="sm">
        <Text size="sm" fw={600} c="pink.7">
          📱 Install Opal Appointments
        </Text>
        <Text size="xs" c="dimmed">
          Install this app on your device for quick access and offline use!
        </Text>
        <Group justify="space-between" gap="xs">
          <Button 
            variant="subtle" 
            size="xs" 
            onClick={() => setShowInstallPrompt(false)}
          >
            Maybe Later
          </Button>
          <Button 
            size="xs" 
            color="pink" 
            onClick={handleInstallClick}
          >
            Install App
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
