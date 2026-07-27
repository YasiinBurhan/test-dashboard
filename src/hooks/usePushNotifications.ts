import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

// Set to true only if you have a configured FCM server and want to register device tokens.
// Keeping this false avoids native GMS/Firebase crashes on devices with Play Services issues.
const ENABLE_REMOTE_PUSH = false;

export const usePushNotifications = (isAuthenticated: boolean = false) => {
  useEffect(() => {
    // Only register notifications on native mobile devices and when authenticated
    if (Capacitor.isNativePlatform() && isAuthenticated) {
      registerNotifications();
    }
  }, [isAuthenticated]);

  const registerNotifications = async () => {
    try {
      // First, request Local Notifications permission - this is super stable and will NOT crash!
      const localPerm = await LocalNotifications.requestPermissions();

      // Create a local notifications channel for Android 8+
      if (Capacitor.getPlatform() === 'android') {
        try {
          await LocalNotifications.createChannel({
            id: 'default',
            name: 'Default',
            description: 'General Notifications',
            importance: 4,
            vibration: true,
          });
        } catch (channelErr) {
          console.warn('Error creating local notifications channel:', channelErr);
        }
      }

      // Set up local notification action listeners
      try {
        LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
          console.log('Local action performed: ', notification);
        });
      } catch (localListenerErr) {
        console.warn('Error adding local notification action listener:', localListenerErr);
      }

      // Only proceed with remote FCM Push Notifications if explicitly enabled
      if (ENABLE_REMOTE_PUSH && localPerm.display === 'granted') {
        try {
          // On success, we should be able to receive notifications
          PushNotifications.addListener('registration', (token: Token) => {
            console.log('Push registration success, token: ' + token.value);
          });

          // Some issue with our setup and push will not work
          PushNotifications.addListener('registrationError', (error: any) => {
            console.error('Error on registration: ' + JSON.stringify(error));
          });

          // Show us the notification payload if the app is open on our device
          PushNotifications.addListener('pushNotificationReceived', async (notification) => {
            console.log('Push received: ', notification);
            
            // When the app is in the foreground, Push Notifications don't always show the system UI.
            // We can use LocalNotifications to show it explicitly if needed.
            if (Capacitor.getPlatform() === 'android') {
              try {
                await LocalNotifications.schedule({
                  notifications: [
                    {
                      id: new Date().getTime(),
                      title: notification.title || 'Notification',
                      body: notification.body || '',
                      channelId: 'default',
                      smallIcon: 'ic_stat_icon_config_sample', // Default icon if configured
                      iconColor: '#3b82f6', // blue-500
                    }
                  ]
                });
              } catch (scheduleErr) {
                console.warn('FCM callback scheduling local notification failed:', scheduleErr);
              }
            }
          });

          // Method called when tapping on a notification
          PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
            console.log('Push action performed: ', notification);
          });

          // Request push permissions and register safely
          const permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'granted') {
            await PushNotifications.register();
          } else {
            const reqStatus = await PushNotifications.requestPermissions();
            if (reqStatus.receive === 'granted') {
              await PushNotifications.register();
            }
          }
        } catch (pushErr) {
          console.warn('FCM Push Notification setup bypassed/unsupported on this device:', pushErr);
        }
      } else {
        console.log('Remote FCM Push Notifications bypassed (LocalNotifications active).');
      }

    } catch (e) {
      console.error('Notification setup error:', e);
    }
  };
};
