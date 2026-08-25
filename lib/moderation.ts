const blockedFragments=[
  'fuck','shit','cunt','nigger','nigga','faggot','rape','rapist','nazi','hitler',
  'admin','moderator','oneminute','one minute','support','staff',
];

function normalise(value:string){return value.toLowerCase().replace(/[^a-z0-9]/g,'')}

export function isAllowedDisplayName(value:string){
  const compact=normalise(value);
  if(compact.length<2)return false;
  return !blockedFragments.some(fragment=>compact.includes(normalise(fragment)));
}
