import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      app: {
        title: 'AI Agent Village Monitor',
        settings: 'Settings',
        dialogue: 'Dialogue',
        onboard: 'Onboard',
      },
      dialogue: {
        thread: 'Thread',
        control: 'Control',
        info: 'Info',
        closeText: 'Close (Esc)',
        closeAria: 'Close dialogue (Esc)',
        ariaPanel: 'Agent dialogue panel',
        ariaTabs: 'Dialogue tabs',
      },
      thread: {
        agentLabel: 'Agent: {{id}}',
        status: { connecting: 'Connecting', connected: 'Connected', disconnected: 'Disconnected' },
        latency: 'rtt {{ms}}ms',
        inputPlaceholder: 'Ask the agent...',
        send: 'Send',
        ownerRequired: 'Owner role required',
        newMessages: '{{count}} new message',
        newMessages_plural: '{{count}} new messages',
      },
      onboarding: {
        step: {
          login: 'Login',
          org: 'Select Organization',
          install: 'Install App / Grant Scopes',
          create: 'Create Village',
          sync: 'Sync Repos & Houses',
          enter: 'Enter Village',
          demo: 'Try Demo Mode',
        },
        loginCancelled: 'Login cancelled. You can try again.',
        loginTimeout: 'Login timed out. Please try again.',
        waitingInstall: 'Waiting for installation to complete…',
        installDetected: 'Installation detected. Continuing…',
        installNotConfirmed:
          'We could not confirm the install/scopes. You can try again, grant scopes via OAuth, or continue anyway.',
        syncing: 'Syncing repositories…',
      },
    },
  },
  es: {
    translation: {
      app: {
        title: 'Monitor de Aldea de Agentes IA',
        settings: 'Ajustes',
        dialogue: 'Diálogo',
        onboard: 'Comenzar',
      },
      dialogue: {
        thread: 'Hilo',
        control: 'Control',
        info: 'Info',
        close: 'Cerrar (Esc)',
        ariaPanel: 'Panel de diálogo de agente',
        ariaTabs: 'Pestañas de diálogo',
      },
      thread: {
        agentLabel: 'Agente: {{id}}',
        status: { connecting: 'Conectando', connected: 'Conectado', disconnected: 'Desconectado' },
        latency: 'rtt {{ms}}ms',
        inputPlaceholder: 'Pregunta al agente…',
        send: 'Enviar',
        ownerRequired: 'Se requiere rol de propietario',
        newMessages: '{{count}} mensaje nuevo',
        newMessages_plural: '{{count}} mensajes nuevos',
      },
      onboarding: {
        step: {
          login: 'Iniciar sesión',
          org: 'Seleccionar organización',
          install: 'Instalar app / Conceder permisos',
          create: 'Crear aldea',
          sync: 'Sincronizar repos y casas',
          enter: 'Entrar a la aldea',
          demo: 'Modo demo',
        },
        loginCancelled: 'Inicio cancelado. Inténtalo de nuevo.',
        loginTimeout: 'El inicio de sesión expiró. Inténtalo de nuevo.',
        waitingInstall: 'Esperando a que finalice la instalación…',
        installDetected: 'Instalación detectada. Continuando…',
        installNotConfirmed:
          'No pudimos confirmar la instalación/permisos. Inténtalo de nuevo o continúa.',
        syncing: 'Sincronizando repositorios…',
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem('lang') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
