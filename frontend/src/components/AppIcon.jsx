export default function AppIcon({ name, className = '', title }) {
  const commonProps = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': title ? undefined : 'true',
    role: title ? 'img' : undefined,
  };

  const titled = (node) => (
    <svg {...commonProps}>
      {title ? <title>{title}</title> : null}
      {node}
    </svg>
  );

  switch (name) {
    case 'add':
      return titled(
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    case 'dashboard':
      return titled(
        <>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
          <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        </>
      );
    case 'insights':
      return titled(
        <>
          <path d="M4 18 9 12l3 3 7-9" />
          <path d="M18 6h2v2" />
          <path d="M4 20h16" />
        </>
      );
    case 'history':
      return titled(
        <>
          <path d="M12 7v5l3 2" />
          <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
          <path d="M4 5v4h4" />
        </>
      );
    case 'straighten':
      return titled(
        <>
          <path d="M4 16.5h16" />
          <path d="M7.5 12.5 10 8.5h4l2.5 4" />
          <path d="M6 16.5 8 12.5" />
          <path d="M18 16.5 16 12.5" />
        </>
      );
    case 'flag':
      return titled(
        <>
          <path d="M6 20V5" />
          <path d="M6 5h10l-2 3 2 3H6" />
        </>
      );
    case 'calendar_today':
    case 'calendar':
      return titled(
        <>
          <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
          <path d="M8 3.5v4" />
          <path d="M16 3.5v4" />
          <path d="M4 9.5h16" />
          <path d="M8 13h3" />
          <path d="M8 16h6" />
        </>
      );
    case 'workspace_premium':
      return titled(
        <>
          <path d="m12 4 2.2 4.4 4.8.7-3.5 3.4.8 4.8L12 15l-4.3 2.3.8-4.8L5 9.1l4.8-.7Z" />
        </>
      );
    case 'emoji_events':
    case 'medal':
      return titled(
        <>
          <path d="M8 4h8v3a4 4 0 0 1-8 0Z" />
          <path d="M9 18h6" />
          <path d="M12 11v7" />
          <path d="M16 5h2a2 2 0 0 1 0 4h-2" />
          <path d="M8 5H6a2 2 0 0 0 0 4h2" />
        </>
      );
    case 'help':
      return titled(
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.6 9.5a2.6 2.6 0 1 1 4.5 1.8c-.7.7-1.6 1.2-1.6 2.3" />
          <path d="M12 16.8h.01" />
        </>
      );
    case 'settings':
      return titled(
        <>
          <circle cx="12" cy="12" r="2.8" />
          <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7.4 7.4 0 0 0-2-.9l-.4-2.6h-4l-.4 2.6a7.4 7.4 0 0 0-2 .9l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a7.4 7.4 0 0 0 2 .9l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 2-.9l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2Z" />
        </>
      );
    case 'directions_run':
      return titled(
        <>
          <circle cx="16.5" cy="5.5" r="1.5" />
          <path d="m8.5 11 3-2 1.8 1.4 2.2.6" />
          <path d="m10 20 1.2-4.5-2.4-2.1L7 16.5" />
          <path d="m13.5 20-.5-4 2-2 2.5.5" />
        </>
      );
    case 'person':
      return titled(
        <>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </>
      );
    case 'notifications':
      return titled(
        <>
          <path d="M8 17h8" />
          <path d="M10 20h4" />
          <path d="M7 17V11a5 5 0 1 1 10 0v6l1.5 1.5H5.5Z" />
        </>
      );
    case 'upload':
    case 'upload_file':
      return titled(
        <>
          <path d="M12 16V6" />
          <path d="m8.5 9.5 3.5-3.5 3.5 3.5" />
          <path d="M5 18.5v1a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-1" />
        </>
      );
    case 'check_circle':
      return titled(
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.7 12.3 2.2 2.2 4.4-4.9" />
        </>
      );
    case 'error':
      return titled(
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v5" />
          <path d="M12 16.5h.01" />
        </>
      );
    case 'arrow_forward':
    case 'chevron_right':
      return titled(
        <>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </>
      );
    case 'expand_more':
      return titled(
        <>
          <path d="m6 9 6 6 6-6" />
        </>
      );
    case 'expand_less':
      return titled(
        <>
          <path d="m6 15 6-6 6 6" />
        </>
      );
    case 'trending_flat':
      return titled(
        <>
          <path d="M4 12h16" />
          <path d="m14 8 4 4-4 4" />
        </>
      );
    case 'show_chart':
    case 'speed':
      return titled(
        <>
          <path d="M4 18 9 13l3 2 6-7" />
          <path d="M4 20h16" />
        </>
      );
    case 'distance':
      return titled(
        <>
          <path d="M5 16c3-4.8 5.7-7.1 14-8" />
          <path d="M14.5 8H19v4.5" />
          <path d="M5 19h14" />
        </>
      );
    case 'timer':
      return titled(
        <>
          <circle cx="12" cy="13" r="6.5" />
          <path d="M12 13 15 11" />
          <path d="M10 3h4" />
          <path d="M12 6.5V3" />
        </>
      );
    case 'location_on':
    case 'map':
      return titled(
        <>
          <path d="M12 20s5.5-5 5.5-9a5.5 5.5 0 1 0-11 0c0 4 5.5 9 5.5 9Z" />
          <circle cx="12" cy="11" r="2" />
        </>
      );
    case 'territory':
      return titled(
        <>
          <path d="M4.5 7.5 9 5l6 2.5 4.5-2.2v11.2L15 19l-6-2.5-4.5 2.2Z" />
          <path d="M9 5v11.5" />
          <path d="M15 7.5V19" />
        </>
      );
    case 'account_tree':
      return titled(
        <>
          <rect x="4" y="4" width="6" height="5" rx="1.4" />
          <rect x="14" y="15" width="6" height="5" rx="1.4" />
          <rect x="4" y="15" width="6" height="5" rx="1.4" />
          <path d="M7 9v3.2a2 2 0 0 0 2 2h6" />
          <path d="M7 15v-2.8" />
        </>
      );
    case 'fitness_center':
      return titled(
        <>
          <path d="M6 8v8" />
          <path d="M18 8v8" />
          <path d="M3.5 10v4" />
          <path d="M20.5 10v4" />
          <path d="M6 12h12" />
        </>
      );
    case 'sprint':
      return titled(
        <>
          <path d="M6 17c2.8-4.7 5.7-7 12-8" />
          <path d="M14 7h4v4" />
          <path d="M8 20h8" />
        </>
      );
    case 'altitude':
      return titled(
        <>
          <path d="M5 18h14" />
          <path d="m8 18 4-9 4 9" />
          <path d="M12 5V3" />
        </>
      );
    case 'watch':
      return titled(
        <>
          <rect x="7.5" y="7" width="9" height="10" rx="2" />
          <path d="M9 3.5h6" />
          <path d="M9 20.5h6" />
          <path d="M12 10v3l2 1" />
        </>
      );
    case 'bolt':
      return titled(
        <>
          <path d="M13 3 6 13h4l-1 8 7-10h-4l1-8Z" />
        </>
      );
    case 'folder_open':
      return titled(
        <>
          <path d="M3.5 8.5h6l2 2h9v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
          <path d="M3.5 8.5v-2a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2" />
        </>
      );
    case 'support_agent':
      return titled(
        <>
          <path d="M6 12a6 6 0 0 1 12 0" />
          <rect x="5" y="11.5" width="2.5" height="5" rx="1" />
          <rect x="16.5" y="11.5" width="2.5" height="5" rx="1" />
          <path d="M9.5 18.5h5" />
          <path d="M10 10.5h4" />
        </>
      );
    case 'route':
    case 'bridge':
      return titled(
        <>
          <circle cx="6.5" cy="17.5" r="1.5" />
          <circle cx="17.5" cy="6.5" r="1.5" />
          <path d="M8 17c3.5 0 3.5-4 7-4 2.5 0 3-2 3-4.5" />
        </>
      );
    case 'city':
      return titled(
        <>
          <path d="M4 20V9.5L9 7v13" />
          <path d="M9 20V5l6-2v17" />
          <path d="M15 20v-9l5-2v11" />
          <path d="M6.5 12h.01" />
          <path d="M12 8.5h.01" />
          <path d="M12 12h.01" />
          <path d="M17.5 13h.01" />
        </>
      );
    case 'park':
      return titled(
        <>
          <path d="M12 4 7.5 10h9Z" />
          <path d="M12 7.5 6 15h12Z" />
          <path d="M12 15v5" />
          <path d="M8 20h8" />
        </>
      );
    case 'crown':
      return titled(
        <>
          <path d="m4 18 2-10 6 5 6-5 2 10Z" />
          <path d="M6.5 8.5h.01" />
          <path d="M12 5.5h.01" />
          <path d="M17.5 8.5h.01" />
        </>
      );
    case 'streak':
      return titled(
        <>
          <path d="M10 4c1 2.5.4 4.3-.9 6.1-1.2 1.6-1.7 2.9-1.7 4.3A4.6 4.6 0 0 0 12 19a4.6 4.6 0 0 0 4.6-4.6c0-3.1-2-5.4-6.6-10.4Z" />
          <path d="M12 11.5c1.2 1.2 1.8 2.3 1.8 3.5A1.8 1.8 0 0 1 12 16.8 1.8 1.8 0 0 1 10.2 15c0-1 .5-2.1 1.8-3.5Z" />
        </>
      );
    case 'summit':
      return titled(
        <>
          <path d="m4 19 5.5-9 3 5 2-3 5.5 7" />
          <path d="m13.8 6.4 1.2-1.9 1.2 1.9" />
          <path d="M15 4.5V9" />
        </>
      );
    case 'more_horiz':
      return titled(
        <>
          <circle cx="6" cy="12" r="1.2" />
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="18" cy="12" r="1.2" />
        </>
      );
    case 'change_history':
      return titled(
        <>
          <path d="m12 5 7 12H5Z" />
        </>
      );
    case 'search':
      return titled(
        <>
          <circle cx="11" cy="11" r="5.5" />
          <path d="m16 16 4 4" />
        </>
      );
    case 'menu':
      return titled(
        <>
          <path d="M5 7h14" />
          <path d="M5 12h14" />
          <path d="M5 17h14" />
        </>
      );
    case 'dark_mode':
      return titled(
        <>
          <path d="M14.5 4.5a7 7 0 1 0 5 12.5 8 8 0 1 1-5-12.5Z" />
        </>
      );
    case 'light_mode':
    case 'brightness_7':
      return titled(
        <>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2.5v2" />
          <path d="M12 19.5v2" />
          <path d="m4.9 4.9 1.4 1.4" />
          <path d="m17.7 17.7 1.4 1.4" />
          <path d="M2.5 12h2" />
          <path d="M19.5 12h2" />
          <path d="m4.9 19.1 1.4-1.4" />
          <path d="m17.7 6.3 1.4-1.4" />
        </>
      );
    case 'thermostat':
      return titled(
        <>
          <path d="M10.5 5.5a1.5 1.5 0 1 1 3 0v7.1a4.1 4.1 0 1 1-3 0Z" />
          <path d="M12 14.2v4.3" />
          <path d="M12 18.5a2 2 0 1 0 0 .1Z" />
        </>
      );
    case 'water_drop':
      return titled(
        <>
          <path d="M12 4.5c2.9 3.4 4.6 5.8 4.6 8.4A4.6 4.6 0 0 1 12 17.5a4.6 4.6 0 0 1-4.6-4.6c0-2.6 1.7-5 4.6-8.4Z" />
        </>
      );
    case 'air':
      return titled(
        <>
          <path d="M4 10.5h11a2.5 2.5 0 1 0-2.4-3.2" />
          <path d="M4 14h13a2.5 2.5 0 1 1-2.4 3.2" />
          <path d="M4 17.5h7" />
        </>
      );    case 'contrast':
      return titled(
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" />
        </>
      );
    case 'footprint':
      return titled(
        <>
          <ellipse cx="9" cy="8" rx="2" ry="3.5" />
          <path d="M8 11.5c-1.2 1.5-1.8 3.2-1.8 5.5 0 2 1.2 3 2.8 3 1.9 0 3-1.2 3-3.5 0-2.4-1-3.8-2.4-5" />
          <ellipse cx="16.5" cy="7" rx="1.8" ry="3" />
          <path d="M15.7 10.2c1 1.2 1.5 2.6 1.5 4.5 0 1.7-1 2.8-2.5 2.8-1.8 0-2.8-1.1-2.8-3.2 0-2 1-3.3 2.2-4.4" />
        </>
      );
    case 'check':
      return titled(
        <>
          <path d="M5 13l4 4L19 7" />
        </>
      );
    case 'close':
      return titled(
        <>
          <path d="m6 6 12 12" />
          <path d="M18 6 6 18" />
        </>
      );
    case 'logout':
      return titled(
        <>
          <path d="M9 20H5.5a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2H9" />
          <path d="M13 16l4-4-4-4" />
          <path d="M7 12h10" />
        </>
      );
    case 'edit':
      return titled(
        <>
          <path d="M4 20h4l10-10-4-4L4 16v4Z" />
          <path d="m12.5 7.5 4 4" />
        </>
      );
    case 'sleep':
      return titled(
        <>
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </>
      );
    case 'stress':
      return titled(
        <>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </>
      );
    case 'arrow_back':
      return titled(
        <>
          <path d="M19 12H5" />
          <path d="m11 18-6-6 6-6" />
        </>
      );
    case 'play_arrow':
      return titled(
        <>
          <path d="M8 5.14v13.72a.5.5 0 0 0 .76.43l10.83-6.86a.5.5 0 0 0 0-.86L8.76 4.71A.5.5 0 0 0 8 5.14Z" />
        </>
      );
    case 'schedule':
      return titled(
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </>
      );
    case 'self_improvement':
      return titled(
        <>
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v5" />
          <path d="M5 19c2-4 5-5 7-5s5 1 7 5" />
          <path d="M8 12l-2 4" />
          <path d="M16 12l2 4" />
        </>
      );
    case 'sports_gymnastics':
      return titled(
        <>
          <circle cx="12" cy="4.5" r="2" />
          <path d="M12 6.5v6" />
          <path d="M6 9l6-2 6 2" />
          <path d="M9 19l3-6 3 6" />
        </>
      );
    case 'chest':
      return titled(
        <>
          <path d="M5 8c0-1.5 1.5-3 3-3h8c1.5 0 3 1.5 3 3v6c0 2-1 4-3 4h-2l-2-3-2 3h-2c-2 0-3-2-3-4V8Z" />
          <path d="M12 10v6" />
        </>
      );
    case 'shoulders':
      return titled(
        <>
          <circle cx="12" cy="5.5" r="2" />
          <path d="M3 12c2-4 5-5 9-5s7 1 9 5" />
          <path d="M6 12c2-2 4-3 6-3s4 1 6 3" />
        </>
      );
    case 'legs':
      return titled(
        <>
          <path d="M9 4h6" />
          <path d="M9.5 4l-1.5 8l-0.5 8" />
          <path d="M14.5 4l1.5 8l0.5 8" />
          <circle cx="7.5" cy="20" r="1" />
          <circle cx="16.5" cy="20" r="1" />
        </>
      );
    case 'core':
      return titled(
        <>
          <rect x="7.5" y="4" width="9" height="16" rx="2.5" />
          <path d="M7.5 9h9" />
          <path d="M7.5 14h9" />
          <path d="M12 4v16" />
        </>
      );
    case 'arms':
      return titled(
        <>
          <path d="M6 18c-1-3 0-7 3-8c2-1 4 0 5 1c2 2 1 5 0 6" />
          <path d="M14 11c1 1 2 3 1 5" />
          <circle cx="9" cy="6" r="2" />
        </>
      );
    case 'back':
      return titled(
        <>
          <circle cx="12" cy="5.5" r="2" />
          <path d="M9 9c-3 1-5 3-5 6c0 2 1 3 3 3h10c2 0 3-1 3-3c0-3-2-5-5-6" />
          <path d="M12 9v8" />
        </>
      );
    case 'architecture':
      return titled(
        <>
          <path d="m12 4 8 14H4Z" />
          <path d="M9 12h6" />
          <path d="M12 4v14" />
        </>
      );
    case 'boot':
    case 'shoe':
      return titled(
        <>
          <path d="M4 18h14a2 2 0 0 0 2-2v-2c0-1.4-1.1-2-2.5-2.3l-3.5-.7-1.5-3.5a1 1 0 0 0-1-.5H6a2 2 0 0 0-2 2Z" />
          <path d="M6 11h4" />
          <path d="M11.5 11l1 1.8" />
        </>
      );
    case 'chat_bubble_outline':
      return titled(
        <>
          <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17H9l-4 3.5V6.5A1.5 1.5 0 0 1 6.5 5Z" />
        </>
      );
    case 'coach_voice':
      return titled(
        <>
          <rect x="9.5" y="3" width="5" height="11" rx="2.5" />
          <path d="M6 11a6 6 0 0 0 12 0" />
          <path d="M12 17v3.5" />
          <path d="M9 21h6" />
        </>
      );
    case 'delete_sweep':
      return titled(
        <>
          <path d="M5 8h10v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
          <path d="M3.5 6h13" />
          <path d="M8 5h4" />
          <path d="M18 4h3" />
          <path d="M18 8h3" />
          <path d="M18 12h3" />
        </>
      );
    case 'favorite':
      return titled(
        <>
          <path d="M12 20s-7-4.4-7-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3c0 5.6-7 10-7 10Z" />
        </>
      );
    case 'flame':
      return titled(
        <>
          <path d="M12 3c1.5 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .4-2 1-2.8C8.5 9.5 9 6.5 12 3Z" />
          <path d="M11 14a2 2 0 0 0 2 2" />
        </>
      );
    case 'globe':
      return titled(
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17" />
          <path d="M12 3.5c2.5 3 2.5 14 0 17" />
          <path d="M12 3.5c-2.5 3-2.5 14 0 17" />
        </>
      );
    case 'groups':
      return titled(
        <>
          <circle cx="9" cy="9" r="2.6" />
          <circle cx="17" cy="9.5" r="2" />
          <path d="M3.5 18a5.5 5.5 0 0 1 11 0" />
          <path d="M14.5 18a3.5 3.5 0 0 1 6 0" />
        </>
      );
    case 'image_search':
      return titled(
        <>
          <rect x="3.5" y="3.5" width="13" height="11" rx="1.6" />
          <path d="m6 13.5 3-3 3 2 2-1.5" />
          <circle cx="7.5" cy="7" r="1" />
          <circle cx="17" cy="17" r="3" />
          <path d="m19.5 19.5 1.5 1.5" />
        </>
      );
    case 'low_priority':
      return titled(
        <>
          <path d="M3.5 5h11" />
          <path d="M3.5 9h7" />
          <path d="M3.5 13h7" />
          <path d="M14 15v5" />
          <path d="m11.5 17.5 2.5 2.5 2.5-2.5" />
        </>
      );
    case 'monitor_heart':
      return titled(
        <>
          <rect x="3" y="5" width="18" height="11" rx="2" />
          <path d="M6 11h2.5l1.5-2 2.5 4 1.5-2H18" />
          <path d="M8 20h8" />
          <path d="M12 16v4" />
        </>
      );
    case 'telemetry_cadence':
      return titled(
        <>
          <path d="M5.5 18.5c2.5-4 5.3-6.4 10.5-7.5" />
          <path d="M8 8.5h8" />
          <path d="M8 5.5h5" />
          <path d="M16 8.5l2.5 2.5-2.5 2.5" />
          <path d="M6 21h12" />
        </>
      );
    case 'telemetry_stride':
      return titled(
        <>
          <path d="M4.5 17.5h15" />
          <path d="M7 14.5c2.2-2.2 4.7-3.4 8-4" />
          <path d="M6 17.5l2-3" />
          <path d="M18 17.5l-2-3" />
          <path d="M7.5 20.5h9" />
        </>
      );
    case 'telemetry_ground_contact':
      return titled(
        <>
          <path d="M6 19h12" />
          <path d="M8 15.5h7.5c1.4 0 2.5.8 2.5 2" />
          <path d="M8 15.5c.7-2 1.8-3.5 3.4-4.7" />
          <path d="M12 7.5v3.5" />
          <path d="M9.8 9.3 12 11l2.2-1.7" />
          <circle cx="12" cy="5" r="1.6" />
        </>
      );
    case 'telemetry_vertical':
      return titled(
        <>
          <path d="M12 4v16" />
          <path d="m8.5 7.5 3.5-3.5 3.5 3.5" />
          <path d="m8.5 16.5 3.5 3.5 3.5-3.5" />
          <path d="M5 12h14" />
          <path d="M7 9.5c3.2 2.6 6.8 2.6 10 0" />
        </>
      );
    case 'telemetry_elevation':
      return titled(
        <>
          <path d="M4 19h16" />
          <path d="m6.5 19 4.2-10 2.6 5 1.8-3.2 3.4 8.2" />
          <path d="M8 14h3" />
          <path d="M15 8.5V4" />
          <path d="m12.8 6.2 2.2-2.2 2.2 2.2" />
        </>
      );
    case 'moon':
      return titled(
        <>
          <path d="M14.5 4.5a7 7 0 1 0 5 12.5 8 8 0 1 1-5-12.5Z" />
        </>
      );
    case 'newsmode':
      return titled(
        <>
          <rect x="3.5" y="5" width="14" height="14" rx="1.5" />
          <path d="M17.5 9H20v8.5a1.5 1.5 0 0 1-1.5 1.5h-1" />
          <path d="M6.5 8.5h8" />
          <path d="M6.5 12h8" />
          <path d="M6.5 15.5h5" />
        </>
      );
    case 'palette':
      return titled(
        <>
          <path d="M12 3.5a8.5 8.5 0 1 0 0 17 1.5 1.5 0 0 0 1.4-2c-.4-1.1.4-2 1.6-2H17a3.5 3.5 0 0 0 3.5-3.5A8.5 8.5 0 0 0 12 3.5Z" />
          <circle cx="7.5" cy="11" r="1" />
          <circle cx="11" cy="7" r="1" />
          <circle cx="15" cy="7.5" r="1" />
          <circle cx="17" cy="11.5" r="1" />
        </>
      );
    case 'psychology':
      return titled(
        <>
          <path d="M15 4a5 5 0 0 0-5 5v1.2A3 3 0 0 0 11.5 16H13v2.5h4V14h1a2 2 0 0 0 2-2c0-.7-.4-1.3-1-1.7A5 5 0 0 0 15 4Z" />
          <path d="M13 8.5a2 2 0 0 0 0 4" />
        </>
      );
    case 'radio_button_unchecked':
      return titled(
        <>
          <circle cx="12" cy="12" r="8.5" />
        </>
      );
    case 'refresh':
      return titled(
        <>
          <path d="M4.5 12a7.5 7.5 0 0 1 13-5.1" />
          <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1" />
          <path d="M17.5 3v4h-4" />
          <path d="M6.5 21v-4h4" />
        </>
      );
    case 'sunrise':
      return titled(
        <>
          <path d="M5 18h14" />
          <path d="M7 14a5 5 0 0 1 10 0" />
          <path d="M12 4v3" />
          <path d="m4.5 9 2 2" />
          <path d="m19.5 9-2 2" />
          <path d="M3.5 18h17" />
        </>
      );
    case 'sync':
      return titled(
        <>
          <path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5" />
          <path d="M19.5 12a7.5 7.5 0 0 1-12.6 5.5" />
          <path d="M17 3v4h-4" />
          <path d="M7 21v-4h4" />
        </>
      );
    case 'translate':
      return titled(
        <>
          <path d="M4 6h9" />
          <path d="M8.5 4v2" />
          <path d="M11 14c-2.5-1.5-4.5-4-5.5-8" />
          <path d="M4 14c2-5 5-8 9-8" />
          <path d="M12.5 20.5 16 12l3.5 8.5" />
          <path d="M13.5 18h5" />
        </>
      );
    case 'trending_up':
      return titled(
        <>
          <path d="M4 17 10 11l3 3 7-8" />
          <path d="M14 6h6v6" />
        </>
      );
    case 'trending_down':
      return titled(
        <>
          <path d="M4 7 10 13l3-3 7 8" />
          <path d="M14 18h6v-6" />
        </>
      );
    case 'trophy':
      return titled(
        <>
          <path d="M8 4h8v3a4 4 0 0 1-8 0Z" />
          <path d="M9 18h6" />
          <path d="M12 11v7" />
          <path d="M16 5h2a2 2 0 0 1 0 4h-2" />
          <path d="M8 5H6a2 2 0 0 0 0 4h2" />
          <path d="M9 20h6" />
        </>
      );
    case 'vdot':
      return titled(
        <>
          <path d="M4 14a8 8 0 0 1 16 0" />
          <path d="m12 14 4-4" />
          <circle cx="12" cy="14" r="1.2" />
          <path d="M6 18h12" />
        </>
      );
    case 'warning':
      return titled(
        <>
          <path d="M12 4 21 20H3Z" />
          <path d="M12 10v4.5" />
          <path d="M12 17.5h.01" />
        </>
      );
    case 'weekend':
      return titled(
        <>
          <path d="M4 12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1v-2H7v2H6a2 2 0 0 1-2-2Z" />
          <path d="M7 12V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
        </>
      );
    case 'zones':
      return titled(
        <>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5.5" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      );
    default:
      // Neutral filler — a simple bullet circle rather than a "?" alarm. A
      // missing icon shouldn't shout at the runner; it just leaves a calm
      // placeholder visible to operators in dev. The drift smoke test
      // (runsAppIconCoverage.smoke.test.js) prevents new missing names
      // from shipping silently.
      return titled(
        <>
          <circle cx="12" cy="12" r="3" />
        </>
      );
  }
}
