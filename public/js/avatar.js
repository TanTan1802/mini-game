// Nhân vật: vẽ bằng SVG từ một cấu hình nhỏ gọn (gửi qua mạng chỉ vài con số)
(function () {
  const SKIN = ['#ffe3cc', '#f6c9a2', '#e2a679', '#c4865a', '#8a5a3c'];
  const HAIR_COLORS = ['#2b1d14', '#5a3825', '#a0522d', '#e2b950', '#d94f3d', '#7a52d1', '#3a7bd5', '#ece6dc'];
  const OUTFIT_COLORS = ['#e85d3a', '#2f9d6b', '#3d7be2', '#f2b134', '#8e4fd1', '#1aa6b0', '#e06bb0', '#2f3742'];
  const BG = ['#ffd9c2', '#cfeedd', '#cfe0ff', '#fff1b8', '#e7d7ff', '#c9f1f3', '#ffd6ea', '#e3e3e3'];

  const OPTIONS = {
    skin: { label: 'Màu da', count: SKIN.length, colors: SKIN },
    hair: { label: 'Kiểu tóc', count: 8, names: ['Ngắn', 'Dựng', 'Dài', 'Búi', 'Xoăn', 'Bob', 'Rẽ ngôi', 'Trọc'] },
    hairColor: { label: 'Màu tóc', count: HAIR_COLORS.length, colors: HAIR_COLORS },
    eyes: { label: 'Mắt', count: 5, names: ['Tròn', 'Cười', 'Nháy mắt', 'Long lanh', 'Lim dim'] },
    mouth: { label: 'Miệng', count: 5, names: ['Mỉm cười', 'Cười tươi', 'Ngạc nhiên', 'Lè lưỡi', 'Nghiêm túc'] },
    outfit: { label: 'Trang phục', count: 4, names: ['Áo thun', 'Áo hoodie', 'Sơ mi cà vạt', 'Áo sọc'] },
    outfitColor: { label: 'Màu áo', count: OUTFIT_COLORS.length, colors: OUTFIT_COLORS },
    acc: { label: 'Phụ kiện', count: 9, names: ['Không', 'Kính cận', 'Kính râm', 'Mũ lưỡi trai', 'Mũ tai bèo', 'Tai nghe', 'Vương miện', 'Nón lá', 'Nơ'] },
    bg: { label: 'Màu nền', count: BG.length, colors: BG },
  };
  const KEYS = Object.keys(OPTIONS);

  function normalize(cfg) {
    const out = {};
    KEYS.forEach((k) => {
      const v = Math.floor(Number(cfg && cfg[k]));
      out[k] = Number.isFinite(v) && v >= 0 && v < OPTIONS[k].count ? v : 0;
    });
    return out;
  }

  function random() {
    const c = {};
    KEYS.forEach((k) => { c[k] = Math.floor(Math.random() * OPTIONS[k].count); });
    if (Math.random() < 0.45) c.acc = 0;
    return c;
  }

  // Tạo màu đậm hơn để làm viền/bóng
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
    const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
    const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  function hairBack(style, col) {
    if (style === 2) return `<path d="M30 52 Q28 96 40 104 L80 104 Q92 96 90 52 Z" fill="${col}"/>`;
    if (style === 5) return `<path d="M32 50 Q30 82 38 86 L82 86 Q90 82 88 50 Z" fill="${col}"/>`;
    if (style === 3) return `<circle cx="60" cy="22" r="11" fill="${col}"/>`;
    return '';
  }

  function hairFront(style, col) {
    const d = shade(col, 0.8);
    switch (style) {
      case 0: return `<path d="M33 54 Q31 27 60 26 Q89 27 87 54 Q84 41 72 38 Q60 44 46 39 Q37 43 33 54Z" fill="${col}"/>`;
      case 1: return `<path d="M33 52 L36 30 L43 37 L48 22 L55 33 L61 19 L67 32 L74 22 L78 36 L85 29 L87 52 Q80 40 60 40 Q42 40 33 52Z" fill="${col}"/>`;
      case 2: return `<path d="M32 58 Q30 26 60 25 Q90 26 88 58 Q86 42 74 36 Q62 46 44 40 Q35 46 32 58Z" fill="${col}"/>`;
      case 3: return `<path d="M33 52 Q32 28 60 27 Q88 28 87 52 Q78 37 60 36 Q42 37 33 52Z" fill="${col}"/><circle cx="60" cy="22" r="8" fill="${d}" opacity=".35"/>`;
      case 4: return [[38, 40], [46, 31], [56, 27], [66, 27], [75, 31], [83, 40], [33, 50], [87, 50]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${col}"/>`).join('');
      case 5: return `<path d="M31 62 Q28 26 60 25 Q92 26 89 62 L84 62 Q84 44 76 40 Q60 46 44 40 Q36 44 36 62Z" fill="${col}"/>`;
      case 6: return `<path d="M33 54 Q31 26 62 26 Q90 28 87 52 Q82 36 66 36 Q50 50 33 54Z" fill="${col}"/><path d="M62 26 Q56 34 44 38" stroke="${d}" stroke-width="2" fill="none"/>`;
      default: return `<ellipse cx="52" cy="38" rx="7" ry="3" fill="#fff" opacity=".35"/>`;
    }
  }

  function eyes(style) {
    const k = '#2b2118';
    switch (style) {
      case 1: return `<path d="M45 61 Q50 55 55 61 M65 61 Q70 55 75 61" stroke="${k}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      case 2: return `<circle cx="50" cy="60" r="3.6" fill="${k}"/><path d="M65 61 Q70 56 75 61" stroke="${k}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      case 3: return [50, 70].map((x) => `<circle cx="${x}" cy="60" r="6" fill="#fff" stroke="${k}" stroke-width="1.5"/><circle cx="${x}" cy="61" r="3.8" fill="${k}"/><circle cx="${x + 1.5}" cy="59" r="1.4" fill="#fff"/>`).join('');
      case 4: return `<path d="M45 61 L55 61 M65 61 L75 61" stroke="${k}" stroke-width="3" stroke-linecap="round"/>`;
      default: return `<circle cx="50" cy="60" r="3.6" fill="${k}"/><circle cx="70" cy="60" r="3.6" fill="${k}"/><circle cx="51.2" cy="58.8" r="1.1" fill="#fff"/><circle cx="71.2" cy="58.8" r="1.1" fill="#fff"/>`;
    }
  }

  function mouth(style) {
    const k = '#5a2b1d';
    switch (style) {
      case 1: return `<path d="M51 70 Q60 82 69 70 Z" fill="#fff" stroke="${k}" stroke-width="2" stroke-linejoin="round"/>`;
      case 2: return `<ellipse cx="60" cy="73" rx="4" ry="5" fill="${k}"/>`;
      case 3: return `<path d="M52 71 Q60 77 68 71" stroke="${k}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M57 74 Q60 81 63 74Z" fill="#e8506a"/>`;
      case 4: return `<path d="M53 73 L67 73" stroke="${k}" stroke-width="2.5" stroke-linecap="round"/>`;
      default: return `<path d="M52 71 Q60 78 68 71" stroke="${k}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    }
  }

  function outfit(style, col, skin) {
    const d = shade(col, 0.78);
    const base = `<path d="M18 120 Q18 92 60 89 Q102 92 102 120 Z" fill="${col}"/>`;
    switch (style) {
      case 1: return `<path d="M30 98 Q60 80 90 98 L86 104 Q60 92 34 104Z" fill="${d}"/>${base}<path d="M60 92 L60 120" stroke="${d}" stroke-width="2"/><path d="M53 95 L52 108 M67 95 L68 108" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
      case 2: return `${base}<path d="M48 90 L60 102 L72 90 L68 89 L60 96 L52 89Z" fill="#fff"/><path d="M57 98 L63 98 L65 118 L60 122 L55 118Z" fill="#d23c3c"/>`;
      case 3: return `${base}<path d="M24 104 L96 104 M21 112 L99 112" stroke="#fff" stroke-width="4" opacity=".75"/><path d="M50 90 Q60 98 70 90" fill="${skin}"/>`;
      default: return `${base}<path d="M49 90 Q60 100 71 90" fill="${skin}"/>`;
    }
  }

  function accessory(style) {
    switch (style) {
      case 1: return `<g stroke="#2b2118" stroke-width="2.2" fill="rgba(255,255,255,.25)"><circle cx="50" cy="60" r="8"/><circle cx="70" cy="60" r="8"/><path d="M58 60 L62 60" fill="none"/></g>`;
      case 2: return `<g fill="#1b1b1b"><rect x="40" y="54" width="18" height="12" rx="5"/><rect x="62" y="54" width="18" height="12" rx="5"/><rect x="56" y="57" width="8" height="3"/></g><path d="M44 57 L50 57" stroke="#fff" stroke-width="2" opacity=".5"/>`;
      case 3: return `<path d="M32 46 Q32 22 60 22 Q88 22 88 46 Z" fill="#e85d3a"/><path d="M60 46 Q92 44 104 50 Q90 54 60 50Z" fill="#c4472a"/><circle cx="60" cy="23" r="3" fill="#c4472a"/>`;
      case 4: return `<path d="M36 42 Q36 20 60 20 Q84 20 84 42 Z" fill="#3a3f2b"/><path d="M24 46 Q60 34 96 46 Q60 52 24 46Z" fill="#2c3020"/>`;
      case 5: return `<path d="M30 58 Q30 22 60 22 Q90 22 90 58" stroke="#2b2b2b" stroke-width="5" fill="none"/><rect x="24" y="52" width="11" height="18" rx="5" fill="#e85d3a"/><rect x="85" y="52" width="11" height="18" rx="5" fill="#e85d3a"/>`;
      case 6: return `<path d="M40 34 L44 16 L52 28 L60 12 L68 28 L76 16 L80 34 Z" fill="#f2c94c" stroke="#c9961a" stroke-width="2" stroke-linejoin="round"/><circle cx="60" cy="27" r="3" fill="#e2483d"/>`;
      case 7: return `<path d="M14 44 L60 6 L106 44 Q60 52 14 44Z" fill="#e8cf8f" stroke="#b89548" stroke-width="2" stroke-linejoin="round"/><path d="M37 25 L83 25 M27 34 L93 34" stroke="#b89548" stroke-width="1.2" opacity=".7"/>`;
      case 8: return `<path d="M72 30 L84 22 L84 38Z M72 30 L60 22 L60 38Z" fill="#ff5c8a"/><circle cx="72" cy="30" r="4" fill="#d93b6a"/>`;
      default: return '';
    }
  }

  /** Trả về chuỗi SVG nhân vật. opts: { size, ring (màu viền), noBg } */
  function svg(cfg, opts = {}) {
    const c = normalize(cfg);
    const size = opts.size || 48;
    const skin = SKIN[c.skin];
    const hair = HAIR_COLORS[c.hairColor];
    const hideHair = c.acc === 3 || c.acc === 4 || c.acc === 7;
    return `<svg class="avatar-svg" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
      <g>
        ${opts.noBg ? '' : `<rect width="120" height="120" fill="${BG[c.bg]}"/><circle cx="60" cy="130" r="60" fill="#fff" opacity=".25"/>`}
        ${hideHair ? '' : hairBack(c.hair, hair)}
        ${outfit(c.outfit, OUTFIT_COLORS[c.outfitColor], skin)}
        <rect x="52" y="78" width="16" height="14" rx="4" fill="${shade(skin, 0.9)}"/>
        <circle cx="34" cy="62" r="6" fill="${skin}"/><circle cx="86" cy="62" r="6" fill="${skin}"/>
        <ellipse cx="60" cy="58" rx="26" ry="28" fill="${skin}"/>
        <ellipse cx="45" cy="69" rx="5" ry="3" fill="#ff7b7b" opacity=".35"/><ellipse cx="75" cy="69" rx="5" ry="3" fill="#ff7b7b" opacity=".35"/>
        ${eyes(c.eyes)}
        ${mouth(c.mouth)}
        ${hideHair ? (c.hair === 7 ? '' : `<path d="M34 50 Q34 44 40 42 L80 42 Q86 44 86 50 Q80 46 60 46 Q40 46 34 50Z" fill="${hair}"/>`) : hairFront(c.hair, hair)}
        ${accessory(c.acc)}
      </g>
      ${opts.ring ? `<circle cx="60" cy="60" r="56" fill="none" stroke="${opts.ring}" stroke-width="7"/>` : ''}
    </svg>`;
  }

  window.Avatar = { OPTIONS, KEYS, normalize, random, svg, SKIN, HAIR_COLORS, OUTFIT_COLORS, BG };
})();
