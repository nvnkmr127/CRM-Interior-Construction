const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'client/src/components/layout/NotificationsPanel.jsx');
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('Notification.requestPermission')) {
  // Add permission request to mount
  const mountInject = `useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);`;
  content = content.replace('export default function NotificationsPanel() {', 'export default function NotificationsPanel() {\n  ' + mountInject);
}

if (!content.includes('new Notification(')) {
  const onMessageInject = `if (newNotification.id) {
            setNotifications(prev => [newNotification, ...prev].slice(0, 20));
            setUnreadCount(c => c + 1);
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(newNotification.type || 'New Notification', {
                body: newNotification.message,
                icon: '/vite.svg'
              });
            }
          }`;
  content = content.replace(/if \(newNotification\.id\) \{[\s\S]*?setUnreadCount\(c => c \+ 1\);\s*\}/, onMessageInject);
}

fs.writeFileSync(file, content);
console.log('Frontend notifications patched');
