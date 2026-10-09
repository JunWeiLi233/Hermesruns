import { useId } from 'react';
import { getRewardArtwork } from '../utils/rewardArtwork';

// Hermes Runner's Passport: route surveys, race bibs, and real running equipment.
// Static local SVG only: no remote assets, effects, or animation.
const INK = '#253447';
const BLUE = '#638399';
const MIST = '#c4d6dc';
const CORAL = '#c45b46';
const PAPER = '#fffdf7';
const SAGE = '#6f8975';
const SAND = '#c8a573';

function Contours({ color = INK }) {
  return <g fill="none" stroke={color} strokeWidth="1.2" opacity=".16">
    <path d="M-5 31C22 42 21 14 52 22S78 45 105 26M-5 40C24 53 23 24 52 31S78 55 105 36" />
    <path d="M-5 83C20 59 44 82 65 68S82 72 105 60M-5 93C20 69 44 92 65 78S82 82 105 70" />
  </g>;
}

function PassportRegistration({ dark }) {
  const color = dark ? PAPER : INK;
  return <g className="reward-passport-registration" fill="none" stroke={color} strokeLinecap="round">
    <circle cx="50" cy="50" r="47.5" strokeWidth="1" opacity=".24" />
    <path d="M9 42H13M8 48H11M9 54H13M84 63H88M86 69H89" strokeWidth="1.3" opacity=".5" />
    <path d="M67 17H79L75 21H67M67 24H75L72 27H67" strokeWidth="1.5" opacity=".7" />
  </g>;
}

function Pin({ x, y, color = CORAL }) {
  return <g transform={`translate(${x} ${y})`}>
    <path d="M0 9C-2 6-7 2-7-2A7 7 0 0 1 7-2C7 2 2 6 0 9Z" fill={color} />
    <circle cy="-2" r="2.3" fill={PAPER} />
  </g>;
}

function Footprint({ x, y, angle = 0, color = INK }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle})`} fill={color}>
    <path d="M-6-12Q0-17 6-12L7 0Q0 5-7 0Z" />
    <rect x="-5" y="6" width="10" height="9" rx="3" />
    <path d="M-4-6H4M-4-1H4" fill="none" stroke={PAPER} strokeWidth="1.2" opacity=".6" />
  </g>;
}

function Shoe() {
  return <g transform="rotate(-12 50 54)">
    <path d="M16 43 31 45 40 31 51 39 55 51C69 54 80 57 84 64V72H16Q11 61 16 43Z" fill={CORAL} />
    <path d="m18 44 13 1 9-14 7 5-13 21H17Z" fill={INK} />
    <path d="M14 67C33 71 65 68 85 66V74Q84 78 77 78H21Q15 78 14 74Z" fill={PAPER} stroke={INK} strokeWidth="1.4" />
    <path d="m39 47 16 5-6 4H33m-1 5h15l-5 4H29" fill="none" stroke={PAPER} strokeWidth="2.6" strokeLinejoin="round" />
    <path d="m42 39 8 3m-12 1 9 3" fill="none" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
    <path d="M24 74H32M40 74H48M56 74H64M72 74H78" stroke={INK} strokeWidth="1.2" />
  </g>;
}

function Bottle({ x = 50, y = 48, scale = 1, color = CORAL }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <rect x="-8" y="-28" width="16" height="6" rx="2" fill={INK} />
    <path d="M-6-22H6V-17Q15-15 15-6V25Q15 29 11 29H-11Q-15 29-15 25V-6Q-15-15-6-17Z" fill={color} />
    <path d="M-14-2H14V19H-14Z" fill={PAPER} />
    <path d="M-8 7H8M-8 12H3" stroke={BLUE} strokeWidth="2" strokeLinecap="round" />
  </g>;
}

function Bib({ mark }) {
  return <g className="reward-passport-bib" transform="rotate(-8 50 48)">
    <path d="M26 28H78V74H26Z" fill={INK} opacity=".1" />
    <path d="M22 24H76V70H22Z" fill={PAPER} stroke={INK} strokeWidth="1.2" />
    <path d="M22 24H76V36H22Z" fill={CORAL} />
    <path d="M27 24H32M66 24H71M27 70H32M66 70H71" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M30 29H44M30 32H39M58 29H69" stroke={PAPER} strokeWidth="1.3" />
    <text x="49" y="61" textAnchor="middle" fill={INK} fontFamily="var(--font-display, sans-serif)" fontWeight="800" fontSize={mark.length > 5 ? 14 : mark.length > 3 ? 19 : 28}>{mark || '›'}</text>
    <path d="M35 65H63" stroke={SAND} strokeWidth="1.3" strokeDasharray="2 2" />
  </g>;
}

function MilestoneTicket({ mark, background }) {
  return <g className="reward-passport-ticket">
    <path d="M27 76H73V95H27Z" fill={PAPER} stroke={INK} strokeWidth=".8" />
    <circle cx="27" cy="85.5" r="2.5" fill={background} /><circle cx="73" cy="85.5" r="2.5" fill={background} />
    <path d="M33 80V91M67 80V91" stroke={SAND} strokeWidth="1" strokeDasharray="1.5 2" />
    <text x="50" y="90.5" textAnchor="middle" fill={INK} fontFamily="var(--font-display, sans-serif)" fontWeight="800" fontSize={mark.length > 4 ? 11 : mark.length > 3 ? 13 : 17}>{mark}</text>
  </g>;
}

function MapPaper() {
  return <>
    <path d="M17 28 37 22 60 29 82 23V74L60 81 37 74 17 80Z" fill={PAPER} stroke={INK} strokeWidth="1.3" />
    <path d="M37 22V74M60 29V81" stroke={SAND} strokeWidth="1.2" />
    <path d="m20 44 14-7m7 20 15-8m8-6 14-8m-55 31 10-5m31 9 14-8" stroke={SAGE} strokeWidth="2" opacity=".5" />
  </>;
}

function ArtworkScene({ scene, mark }) {
  switch (scene) {
    case 'shoe':
      return <>
        <Contours /><path d="M21 25Q41 15 57 31" stroke={SAND} strokeWidth="2" strokeDasharray="3 4" fill="none" />
        <Pin x={21} y={27} /><Shoe />
      </>;
    case 'bib':
      return <>
        <Contours color={SAGE} />
        <path d="M13 72Q21 79 31 72T60 76Q76 79 86 63" stroke={BLUE} strokeWidth="3" fill="none" />
        <circle cx="13" cy="72" r="3" fill={CORAL} /><circle cx="86" cy="63" r="3" fill={CORAL} />
        <Bib mark={mark} />
      </>;
    case 'climb':
      return <>
        <Contours /><path d="M10 78 42 25 58 53 71 37 92 78Z" fill={SAGE} />
        <path d="m42 25-9 15 9-3 8 3Z" fill={PAPER} />
        <path d="M22 66Q43 44 66 66M28 55Q43 40 56 52M17 75Q49 57 84 75" stroke={PAPER} strokeWidth="1.2" fill="none" opacity=".6" />
        <path d="m49 74 9-14-9-6 4-9-9-8" stroke={CORAL} strokeWidth="3" fill="none" strokeLinejoin="round" />
        <circle cx="44" cy="36" r="3" fill={INK} />
      </>;
    case 'finish':
      return <>
        <Contours /><path d="M22 77Q59 83 70 54" stroke={BLUE} strokeWidth="3" strokeDasharray="5 3" fill="none" />
        <path d="M33 18V73" stroke={INK} strokeWidth="3" />
        <path d="M34 20 76 28V52L34 44Z" fill={PAPER} stroke={INK} strokeWidth="1" />
        <path d="m34 20 11 2v12l-11-2Zm22 4 10 2v12l-10-2Zm-11 10 11 2v12l-11-2Zm21 4 10 2v12l-10-2Z" fill={INK} />
        <path d="M23 69H43" stroke={CORAL} strokeWidth="3" /><Pin x={73} y={72} />
      </>;
    case 'endurance':
      return <>
        <Contours /><path d="M14 61Q24 15 48 35T84 45Q88 73 60 69T25 72Q6 77 14 61Z" stroke={INK} strokeWidth="9" fill="none" />
        <path d="M14 61Q24 15 48 35T84 45Q88 73 60 69T25 72Q6 77 14 61Z" stroke={PAPER} strokeWidth="1.6" strokeDasharray="4 4" fill="none" />
        <path d="M57 24 67 11 80 26" stroke={SAGE} strokeWidth="3" fill="none" />
        <Pin x={25} y={45} /><circle cx="72" cy="65" r="3" fill={CORAL} />
      </>;
    case 'atlas':
      return <>
        <Contours /><MapPaper />
        <path d="M24 62C44 73 41 41 55 45S68 61 76 44" stroke={CORAL} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="24" cy="62" r="3" fill={INK} /><circle cx="76" cy="44" r="3" fill={INK} />
        <circle cx="75" cy="24" r="10" fill={INK} /><path d="m75 16-5 14 5-3 5 3Z" fill={PAPER} /><path d="m75 16 5 14-5-3Z" fill={CORAL} />
      </>;
    case 'logbook':
      return <>
        <Contours /><path d="M21 25Q35 17 50 25 65 17 79 25V74Q63 65 50 74 37 65 21 74Z" fill={INK} />
        <path d="M25 27Q37 21 49 27V68Q37 62 25 68ZM51 27Q64 21 75 27V68Q64 62 51 68Z" fill={PAPER} />
        <path d="M50 25V75" stroke={SAND} strokeWidth="2" />
        {[35, 46, 57].map((y) => <g key={y}>
          <path d={`m29 ${y} 2 2 4-4`} stroke={SAGE} strokeWidth="1.8" fill="none" />
          <path d={`M38 ${y}H45M56 ${y}H70`} stroke={BLUE} strokeWidth="1.5" />
        </g>)}
        <path d="M67 25V47l-4-3-4 3V25Z" fill={CORAL} />
      </>;
    case 'footsteps':
      return <>
        <Contours /><path d="M24 70Q68 76 62 23" stroke={CORAL} strokeWidth="2" strokeDasharray="3 4" fill="none" />
        <Footprint x={31} y={57} angle={-32} /><Footprint x={58} y={43} angle={8} color={CORAL} /><Footprint x={49} y={20} angle={-12} />
      </>;
    case 'training-block':
      return <>
        <Contours /><rect x="23" y="25" width="54" height="48" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.3" />
        <path d="M23 25H77V36H23Z" fill={INK} /><path d="M35 21V29M65 21V29" stroke={SAND} strokeWidth="3" strokeLinecap="round" />
        {[0, 1, 2].map((column) => [0, 1].map((row) => <rect key={`${column}-${row}`} x={31 + column * 14} y={43 + row * 15} width="9" height="9" rx="1" fill={column === 2 && row === 1 ? CORAL : SAGE} />))}
        <path d="M36 48H64V63H36" stroke={PAPER} strokeWidth="1.5" fill="none" />
      </>;
    case 'weekly-rhythm':
      return <>
        <Contours /><path d="M17 70H83M17 43H83" stroke={BLUE} strokeWidth="1.3" strokeDasharray="3 4" />
        {[28, 43, 58, 73].map((x, index) => <g key={x}>
          <rect x={x - 5} y={35 - index * 3} width="10" height={35 + index * 3} rx="2" fill={index === 3 ? CORAL : SAGE} />
          <circle cx={x} cy={26 - index * 3} r="3" fill={INK} />
        </g>)}
        <path d="M28 26 43 23 58 20 73 17" stroke={INK} strokeWidth="1.4" fill="none" />
      </>;
    case 'dawn':
      return <>
        <Contours color={PAPER} /><path d="M27 58A23 23 0 0 1 73 58Z" fill={CORAL} />
        <path d="M50 21V29M22 30l6 6M78 30l-6 6" stroke={SAND} strokeWidth="2" strokeLinecap="round" />
        <path d="M9 58H91" stroke={PAPER} strokeWidth="2" />
        <path d="M20 87Q31 75 59 73T77 65" stroke={MIST} strokeWidth="3" fill="none" /><circle cx="77" cy="65" r="3" fill={CORAL} />
      </>;
    case 'headlamp':
      return <>
        <Contours color={PAPER} /><path d="M43 50 11 73 76 83 63 50Z" fill={SAND} opacity=".55" />
        <path d="M14 33Q50 13 86 33L83 43Q50 26 17 43Z" fill={BLUE} />
        <rect x="35" y="29" width="30" height="23" rx="6" fill={PAPER} />
        <rect x="39" y="32" width="22" height="17" rx="4" fill={CORAL} /><circle cx="50" cy="40.5" r="6" fill={PAPER} />
        <path d="M18 85Q41 65 73 75" stroke={PAPER} strokeWidth="2" strokeDasharray="3 4" fill="none" />
      </>;
    case 'night-route':
      return <>
        <Contours color={PAPER} /><path d="M61 18A17 17 0 1 0 75 43C56 45 49 28 61 18Z" fill={SAND} />
        <path d="M20 81C22 56 48 64 47 49S27 49 32 33" stroke={PAPER} strokeWidth="3" fill="none" />
        <circle cx="20" cy="81" r="4" fill={CORAL} /><circle cx="32" cy="33" r="3" fill={CORAL} />
        <path d="M57 77H76M66.5 68V86" stroke={BLUE} strokeWidth="1.4" />
      </>;
    case 'weekend-loop':
      return <>
        <Contours /><rect x="19" y="24" width="27" height="51" rx="3" fill={PAPER} stroke={INK} strokeWidth="1" transform="rotate(-7 32 49)" />
        <rect x="54" y="24" width="27" height="51" rx="3" fill={PAPER} stroke={INK} strokeWidth="1" transform="rotate(7 67 49)" />
        <path d="M25 33H39M61 33H75" stroke={SAND} strokeWidth="2" />
        <path d="M33 42C14 43 19 74 40 60S78 73 77 51 52 48 55 60 87 59 68 41" stroke={CORAL} strokeWidth="3" fill="none" />
        <circle cx="33" cy="42" r="3" fill={INK} /><circle cx="68" cy="41" r="3" fill={BLUE} />
      </>;
    case 'city-map':
    case 'commute':
      return <>
        <Contours /><path d="M18 25H82V77H18Z" fill={PAPER} stroke={INK} strokeWidth="1.2" />
        <path d="M18 42H82M18 61H82M36 25V77M61 25V77" stroke={MIST} strokeWidth="4" />
        <path d="M24 29h7v8h-7Zm18 0h13v8H42Zm24 17h10v10H66ZM22 66h9v6h-9ZM43 66h12v6H43Z" fill={BLUE} />
        <path d="M27 53H49V34H72" stroke={CORAL} strokeWidth="3" fill="none" strokeLinejoin="round" />
        <Pin x={27} y={54} /><circle cx="72" cy="34" r="3" fill={INK} />
        {scene === 'commute' && <g transform="translate(35 36) scale(.52)"><Shoe /></g>}
      </>;
    case 'trail-map':
      return <>
        <Contours /><MapPaper />
        <path d="M27 71C20 48 58 64 49 41S65 21 72 40" stroke={CORAL} strokeWidth="3" fill="none" />
        <path d="M22 47 29 31 36 47ZM58 70 66 51 74 70Z" fill={SAGE} />
        <path d="M29 47V54M66 70V76" stroke={INK} strokeWidth="2" /><circle cx="27" cy="71" r="3" fill={INK} /><Pin x={72} y={38} />
      </>;
    case 'crossing':
      return <>
        <Contours /><path d="M7 62Q50 48 93 61V79Q50 69 7 81Z" fill={MIST} />
        <path d="M10 85Q50 74 90 85M16 93Q52 83 84 92" stroke={BLUE} strokeWidth="1.5" fill="none" />
        <path d="M18 59Q50 12 82 59" stroke={INK} strokeWidth="3" fill="none" />
        <path d="M18 60H82M18 66H82" stroke={CORAL} strokeWidth="3" />
        <path d="M26 48V60M38 34V60M50 29V60M62 34V60M74 48V60" stroke={INK} strokeWidth="1.5" /><circle cx="24" cy="63" r="3" fill={PAPER} />
      </>;
    case 'fresh-start':
      return <>
        <Contours /><path d="M26 77V52Q26 26 55 26H74" stroke={SAGE} strokeWidth="8" fill="none" />
        <path d="M26 77V52Q26 26 55 26H74" stroke={PAPER} strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
        <path d="m69 20 8 6-8 6" stroke={CORAL} strokeWidth="3" fill="none" strokeLinejoin="round" />
        <path d="M16 72H38" stroke={CORAL} strokeWidth="4" /><Footprint x={62} y={59} angle={35} />
      </>;
    case 'holiday-run':
      return <>
        <Contours /><g transform="rotate(-13 45 48)">
          <path d="M27 66V39Q27 26 38 26 51 26 51 39V43Q61 36 66 43 70 49 59 61L51 70Z" fill={INK} />
          <path d="M26 63H54V80H26Z" fill={PAPER} /><path d="M26 69H54" stroke={CORAL} strokeWidth="3" />
          <path d="M35 33V54M43 32V54" stroke={BLUE} strokeWidth="1.5" />
        </g>
        <path d="M65 31Q52 12 74 17 79 30 65 31ZM66 33Q86 23 86 41 71 48 66 33Z" fill={SAGE} />
        <circle cx="65" cy="33" r="3" fill={CORAL} /><circle cx="61" cy="38" r="3" fill={CORAL} />
      </>;
    case 'spring-trail':
      return <>
        <Contours /><path d="M12 77Q56 88 79 50" stroke={CORAL} strokeWidth="3" fill="none" />
        <path d="M49 74V35M49 58 33 47M49 49 64 37" stroke={INK} strokeWidth="2.5" fill="none" />
        <path d="M49 60C26 61 25 43 32 43 44 43 49 60 49 60ZM49 51C50 28 69 28 69 35 69 46 49 51 49 51Z" fill={SAGE} />
        {[0, 72, 144, 216, 288].map((angle) => <ellipse key={angle} cx="49" cy="27" rx="5" ry="9" transform={`rotate(${angle} 49 34)`} fill={PAPER} />)}
        <circle cx="49" cy="34" r="5" fill={CORAL} /><circle cx="12" cy="77" r="3" fill={INK} />
      </>;
    case 'summer-kit':
      return <>
        <Contours /><g transform="rotate(-12 43 36)">
          <path d="M21 42Q21 17 46 18 62 18 68 38Z" fill={INK} />
          <path d="M18 41Q42 27 73 41L80 48Q53 50 18 47Z" fill={PAPER} stroke={INK} strokeWidth="1.2" />
          <path d="M31 29H49L44 33H29" fill={CORAL} />
        </g>
        <Bottle x={64} y={65} scale={.65} /><path d="M21 70Q32 77 43 73" stroke={SAGE} strokeWidth="3" fill="none" />
      </>;
    case 'autumn-trail':
      return <>
        <Contours /><path d="M17 72Q25 40 50 65T84 63" stroke={BLUE} strokeWidth="3" fill="none" />
        <path d="m65 20 4 14 11-2-6 10 12 7-14 4 1 14-12-8-12 8 1-14-14-4 12-7-6-10 11 2 4-14Z" fill={CORAL} />
        <path d="M60 38V76m0-21-10-9m10 2 11-9" stroke={INK} strokeWidth="1.8" fill="none" />
        <g transform="scale(.65)"><Footprint x={40} y={84} angle={25} /></g>
      </>;
    case 'snow-route':
      return <>
        <Contours color={BLUE} /><path d="M12 75Q43 43 85 55" stroke={PAPER} strokeWidth="12" fill="none" />
        <path d="M12 75Q43 43 85 55" stroke={BLUE} strokeWidth="2.5" strokeDasharray="3 4" fill="none" />
        <Footprint x={45} y={62} angle={-55} />
        <g stroke={INK} strokeWidth="1.8" strokeLinecap="round"><path d="M69 21V43M59 26l20 12M59 38l20-12M66 23l3 3 3-3M66 41l3-3 3 3" /></g>
        <circle cx="28" cy="31" r="2" fill={PAPER} /><circle cx="84" cy="69" r="2" fill={PAPER} />
      </>;
    case 'hydration':
      return <>
        <Contours /><Bottle x={44} y={52} color={BLUE} />
        <path d="M73 29V61" stroke={PAPER} strokeWidth="9" strokeLinecap="round" />
        <path d="M73 44V65" stroke={CORAL} strokeWidth="3" strokeLinecap="round" /><circle cx="73" cy="65" r="5" fill={CORAL} />
        <path d="M19 52c-6-7 5-8 0-14M83 48c-5-6 5-7 0-13" stroke={SAND} strokeWidth="2" fill="none" />
      </>;
    case 'recovery-kit':
      return <>
        <Contours /><g transform="rotate(-25 46 52)">
          <rect x="20" y="33" width="51" height="30" rx="9" fill={BLUE} />
          <ellipse cx="24" cy="48" rx="7" ry="15" fill={INK} /><ellipse cx="24" cy="48" rx="3" ry="7" fill={MIST} />
          <path d="M34 36V60M44 36V60M54 36V60M64 36V60" stroke={PAPER} strokeWidth="2" opacity=".65" />
        </g>
        <path d="M51 65V57H75V68Q75 78 63 79H43Q35 79 35 73 35 67 43 65Z" fill={PAPER} stroke={INK} strokeWidth="1.2" />
        <path d="M52 61H74" stroke={CORAL} strokeWidth="3" /><path d="M40 72H50" stroke={SAGE} strokeWidth="1.5" strokeLinecap="round" />
      </>;
    case 'rain-shell':
      return <>
        <Contours color={BLUE} />
        {[22, 37, 65, 80].map((x) => <path key={x} d={`m${x} 18-4 8m2 56-4 8`} stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" />)}
        <path d="M36 36Q35 18 50 18 65 18 64 36L77 42 87 67 75 72 67 55V81H33V55L25 72 13 67 23 42Z" fill={CORAL} stroke={INK} strokeWidth="1.1" />
        <path d="M37 36Q37 23 50 23 63 23 63 36Z" fill={INK} />
        <path d="M50 36V81M34 62l8 4m16 0 8-4" stroke={PAPER} strokeWidth="1.8" fill="none" /><path d="M23 42 34 53M77 42 66 53" stroke={INK} strokeWidth="4" />
      </>;
    case 'track':
      return <>
        <Contours /><g transform="rotate(-24 50 50)">
          <rect x="14" y="25" width="72" height="50" rx="25" fill={CORAL} />
          <rect x="20" y="31" width="60" height="38" rx="19" stroke={PAPER} strokeWidth="1.2" fill="none" />
          <rect x="26" y="37" width="48" height="26" rx="13" stroke={PAPER} strokeWidth="1.2" fill="none" />
          <rect x="32" y="43" width="36" height="14" rx="7" fill={SAGE} />
          <path d="M60 25V42M64 25V42" stroke={INK} strokeWidth="1.5" /><circle cx="74" cy="50" r="3.5" fill={PAPER} />
        </g>
      </>;
    case 'tempo':
      return <>
        <Contours /><path d="M20 64A30 30 0 0 1 80 64" stroke={INK} strokeWidth="7" fill="none" />
        <path d="M58 36A30 30 0 0 1 80 64" stroke={CORAL} strokeWidth="7" fill="none" />
        <path d="M24 72 35 60 43 64 56 48 65 54 77 44" stroke={BLUE} strokeWidth="3" fill="none" strokeLinejoin="round" />
        <path d="m50 62 10-17" stroke={INK} strokeWidth="2.5" /><circle cx="50" cy="62" r="4" fill={INK} /><path d="M22 77H78" stroke={SAND} strokeWidth="2" strokeDasharray="3 3" />
      </>;
    case 'intervals':
      return <>
        <Contours /><rect x="18" y="28" width="64" height="48" rx="4" fill={PAPER} stroke={INK} strokeWidth="1.2" />
        <path d="M25 64H76M25 35V64" stroke={BLUE} strokeWidth="1.2" />
        <path d="M25 58H32V39H40V58H47V39H55V58H62V39H70V58H76" stroke={CORAL} strokeWidth="3" fill="none" strokeLinejoin="round" /><path d="M30 70H43M50 70H63" stroke={SAND} strokeWidth="1.5" />
      </>;
    case 'route':
      return <>
        <Contours /><path d="M17 67Q9 29 36 29T54 47Q37 72 72 69T77 38" stroke={SAGE} strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M17 67Q9 29 36 29T54 47Q37 72 72 69T77 38" stroke={PAPER} strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
        <Pin x={17} y={64} /><circle cx="77" cy="38" r="4" fill={INK} />
      </>;
    case 'waterfront-route':
      return <>
        <Contours /><path d="M57 5Q35 37 59 60T54 105H105V5Z" fill={BLUE} />
        <path d="M64 19Q53 37 67 48M76 18Q65 37 79 48M71 71Q84 85 70 96M82 67Q96 84 83 98" stroke={MIST} strokeWidth="1.5" fill="none" />
        <path d="M38 22Q23 48 41 67T35 91" stroke={CORAL} strokeWidth="3" fill="none" />
        <Pin x={38} y={24} /><path d="M52 62H76M52 67H76M57 59V70M70 59V70" stroke={PAPER} strokeWidth="2" />
      </>;
    default:
      return <><Contours /><Shoe /></>;
  }
}

export default function RewardIllustration({ reward = {} }) {
  const clipId = `reward-art-${useId().replace(/:/g, '')}`;
  const { scene, mark, background } = getRewardArtwork(reward);
  const dark = background === INK;
  return (
    <svg className="reward-illustration" viewBox="0 0 100 100" aria-hidden="true" focusable="false" data-reward-collection="runner-passport" data-reward-scene={scene} data-reward-mark={mark || undefined}>
      <defs><clipPath id={clipId}><circle cx="50" cy="50" r="50" /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
        <circle cx="50" cy="50" r="50" fill={background} />
        <ArtworkScene scene={scene} mark={mark} />
        {mark && scene !== 'bib' && <MilestoneTicket mark={mark} background={background} />}
        <PassportRegistration dark={dark} />
      </g>
    </svg>
  );
}
