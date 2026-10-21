export const teamSections = [
  { key: 'athletes', icon: 'person' },
  { key: 'team', icon: 'groups' },
  { key: 'messages', icon: 'chat_bubble_outline' },
];

export function teamSection(value) {
  return teamSections.some(section => section.key === value) ? value : 'team';
}
