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

  const lighten = (hex, f) => shade(hex, f);
  const INK = '#2b1d14';

  // ---------- Tóc ----------
  function hairBack(style, col) {
    const o = shade(col, 0.68);
    if (style === 2) return `<path d="M29 54 C27 78 30 98 40 106 L80 106 C90 98 93 78 91 54 Z" fill="${col}" stroke="${o}" stroke-width="1.6"/>
      <path d="M36 70 C35 84 38 96 43 102 M84 70 C85 84 82 96 77 102" stroke="${o}" stroke-width="1.4" fill="none" opacity=".6"/>`;
    if (style === 5) return `<path d="M31 52 C29 70 31 84 37 89 L83 89 C89 84 91 70 89 52 Z" fill="${col}" stroke="${o}" stroke-width="1.6"/>`;
    if (style === 3) return `<circle cx="60" cy="21" r="12" fill="${col}" stroke="${o}" stroke-width="1.6"/>
      <path d="M53 17 Q60 12 67 17" stroke="${lighten(col, 1.4)}" stroke-width="2" fill="none" opacity=".55" stroke-linecap="round"/>`;
    return '';
  }

  function hairFront(style, col) {
    const o = shade(col, 0.68);
    const hi = lighten(col, 1.45);
    const sw = `stroke="${o}" stroke-width="1.6" stroke-linejoin="round"`;
    const shine = (d) => `<path d="${d}" stroke="${hi}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".55"/>`;
    switch (style) {
      case 0: return `<path d="M31 57 C27 33 41 20 60 20 C79 20 93 33 89 57 C86 45 80 40 73 38 C66 44 55 45 46 41 C39 44 34 50 31 57Z" fill="${col}" ${sw}/>${shine('M43 29 Q53 24 64 25')}`;
      case 1: return `<path d="M32 54 L34 32 L42 38 L46 21 L54 33 L60 17 L67 32 L74 21 L78 36 L86 30 L88 54 C82 43 72 40 60 40 C48 40 38 43 32 54Z" fill="${col}" ${sw}/>${shine('M48 30 L52 25 M62 26 L64 21')}`;
      case 2: return `<path d="M30 62 C26 34 41 20 60 20 C79 20 94 34 90 62 C88 47 81 40 74 37 C65 45 52 45 43 40 C36 46 32 53 30 62Z" fill="${col}" ${sw}/>${shine('M42 29 Q52 23 64 24')}`;
      case 3: return `<path d="M31 56 C29 35 42 24 60 24 C78 24 91 35 89 56 C81 42 71 37 60 37 C49 37 39 42 31 56Z" fill="${col}" ${sw}/><rect x="54" y="28" width="12" height="4" rx="2" fill="${shade(col, 0.55)}"/>${shine('M44 34 Q52 30 58 30')}`;
      case 4: {
        const pts = [[37, 42], [45, 32], [55, 27], [65, 27], [75, 32], [83, 42], [32, 52], [88, 52], [50, 36], [70, 36]];
        return pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10.2" fill="${o}"/>`).join('')
          + pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${col}"/>`).join('')
          + pts.slice(0, 6).map(([x, y]) => `<path d="M${x - 4} ${y - 3} q3 -3 6 -1" stroke="${hi}" stroke-width="1.6" fill="none" opacity=".55" stroke-linecap="round"/>`).join('');
      }
      case 5: return `<path d="M29 66 C25 34 40 20 60 20 C80 20 95 34 91 66 L85 66 C85 49 80 43 74 39 C64 46 52 46 44 40 C38 46 35 53 35 66Z" fill="${col}" ${sw}/>${shine('M42 29 Q52 23 65 24')}`;
      case 6: return `<path d="M31 58 C27 34 42 21 62 21 C82 22 93 35 89 56 C84 41 75 37 67 37 C57 49 44 53 31 58Z" fill="${col}" ${sw}/>
        <path d="M62 26 C58 33 52 37 44 40" stroke="${o}" stroke-width="1.6" fill="none"/>${shine('M66 30 Q75 31 81 37')}`;
      default: return `<ellipse cx="50" cy="37" rx="9" ry="4" fill="#fff" opacity=".35" transform="rotate(-15 50 37)"/>`;
    }
  }

  // ---------- Mắt, lông mày ----------
  function brows(style, hair) {
    const c = shade(hair, 0.75);
    const up = style === 1 || style === 3 ? -1.5 : style === 4 ? 1 : 0;
    return `<path d="M42 ${49 + up} Q49 ${45 + up} 56 ${48 + up}" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M64 ${48 + up} Q71 ${45 + up} 78 ${49 + up}" stroke="${c}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  }
  function roundEye(x, r = 1) {
    return `<ellipse cx="${x}" cy="59" rx="${4.4 * r}" ry="${5 * r}" fill="#fff" stroke="${INK}" stroke-width=".9"/>
      <circle cx="${x + 0.3}" cy="${59.7}" r="${3.9 * r}" fill="#5b3a26"/><circle cx="${x + 0.3}" cy="${59.9}" r="${2.2 * r}" fill="#120b07"/>
      <circle cx="${x + 1.8 * r}" cy="${57.8}" r="${1.3 * r}" fill="#fff"/><circle cx="${x - 1.2 * r}" cy="${61.6}" r="${0.6 * r}" fill="#fff" opacity=".8"/>`;
  }
  function eyes(style) {
    const arc = (x) => `<path d="M${x - 5} 60 Q${x} 54 ${x + 5} 60" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    switch (style) {
      case 1: return arc(50) + arc(70);
      case 2: return roundEye(50) + arc(70);
      case 3: return [50, 70].map((x) => `${roundEye(x, 1.3)}<path d="M${x - 6} 53.5 Q${x} 50 ${x + 6} 53.5" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M${x + 5.5} 54 l2.2 -1.6" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`).join('');
      case 4: return [50, 70].map((x) => `<path d="M${x - 5} 59 Q${x} 64 ${x + 5} 59 Z" fill="#fff" stroke="${INK}" stroke-width="1.1"/>
        <circle cx="${x}" cy="60.6" r="2.2" fill="#3a2418"/><path d="M${x - 5.5} 59 L${x + 5.5} 59" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`).join('');
      default: return roundEye(50) + roundEye(70);
    }
  }

  // ---------- Miệng ----------
  function mouth(style) {
    const k = '#6e2a20';
    switch (style) {
      case 1: return `<path d="M50 71 Q60 85 70 71 Z" fill="#5a1d18" stroke="${k}" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M51.5 71.6 Q60 74.6 68.5 71.6 L67.6 73.8 Q60 76 52.4 73.8Z" fill="#fff"/>
        <ellipse cx="60" cy="79.4" rx="5" ry="2.6" fill="#ef6b7f"/>`;
      case 2: return `<ellipse cx="60" cy="74" rx="4.4" ry="5.4" fill="#5a1d18" stroke="${k}" stroke-width="1.4"/><ellipse cx="60" cy="77" rx="2.6" ry="1.5" fill="#ef6b7f"/>`;
      case 3: return `<path d="M52 71.5 Q60 77.5 68 71.5" stroke="${k}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M56.2 74.4 Q60 83 63.8 74.4 Z" fill="#ef6b7f" stroke="#c94a5e" stroke-width="1"/><path d="M60 75.5 L60 79" stroke="#c94a5e" stroke-width="1"/>`;
      case 4: return `<path d="M53.5 73.5 Q60 72.5 66.5 73.5" stroke="${k}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M56 76.5 Q60 77.5 64 76.5" stroke="${k}" stroke-width="1" fill="none" opacity=".35"/>`;
      default: return `<path d="M52 72 Q60 79.5 68 72" stroke="${k}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M57 77.2 Q60 78.2 63 77.2" stroke="${k}" stroke-width="1" fill="none" opacity=".3"/>`;
    }
  }

  // ---------- Áo ----------
  function outfit(style, col, skin) {
    const o = shade(col, 0.66);
    const d = shade(col, 0.82);
    const hi = lighten(col, 1.25);
    const body = `<path d="M15 121 C15 102 29 93 47 90 Q60 97 73 90 C91 93 105 102 105 121 Z" fill="${col}" stroke="${o}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M31 121 C31 110 34 102 40 97 M89 121 C89 110 86 102 80 97" stroke="${d}" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/>
      <path d="M24 104 C27 98 33 95 40 93" stroke="${hi}" stroke-width="2.4" fill="none" opacity=".45" stroke-linecap="round"/>`;
    const neckline = `<path d="M47 90 Q60 101 73 90" fill="${skin}" stroke="${o}" stroke-width="1.6"/>`;
    switch (style) {
      case 1: return `<path d="M33 96 C40 84 80 84 87 96 C78 92 42 92 33 96Z" fill="${d}" stroke="${o}" stroke-width="1.4"/>${body}
        <path d="M45 91 Q60 104 75 91" fill="${d}" stroke="${o}" stroke-width="1.4"/>
        <path d="M44 111 H76 L72 120 H48 Z" fill="${d}" stroke="${o}" stroke-width="1.2"/>
        <path d="M54 97 L53 108 M66 97 L67 108" stroke="#f4ecd8" stroke-width="1.8" stroke-linecap="round"/><circle cx="53" cy="109" r="1.6" fill="#d4af37"/><circle cx="67" cy="109" r="1.6" fill="#d4af37"/>`;
      case 2: return `${body}
        <path d="M47 90 L60 104 L73 90 L69 88 L60 98 L51 88Z" fill="#fff" stroke="#b9b2a2" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M44 92 L56 112 L50 121 L38 121 C38 106 40 97 44 92Z M76 92 L64 112 L70 121 L82 121 C82 106 80 97 76 92Z" fill="${d}" stroke="${o}" stroke-width="1.2"/>
        <path d="M57.4 97 L62.6 97 L61.6 100.5 L58.4 100.5Z" fill="#a8222f"/><path d="M58.4 100.5 L61.6 100.5 L64 117 L60 121 L56 117Z" fill="#c62f3c" stroke="#8e1b26" stroke-width="1"/>
        <path d="M57.2 106 L62.8 104 M56.6 112 L63.4 110" stroke="#f2c94c" stroke-width="1.4" opacity=".8"/>
        <circle cx="60" cy="116" r="0" /><circle cx="52" cy="117" r="1.2" fill="${o}"/>`;
      case 3: return `${body}<path d="M21 104 Q60 100 99 104 M17 112 Q60 108 103 112 M16 120 Q60 116 104 120" stroke="#f4ecd8" stroke-width="3.6" fill="none" opacity=".8"/>${neckline}`;
      default: return `${body}${neckline}<path d="M30 102 L36 98 M90 102 L84 98" stroke="${o}" stroke-width="1.2" opacity=".6"/>`;
    }
  }

  // ---------- Phụ kiện ----------
  function accessory(style) {
    switch (style) {
      case 1: return `<g stroke="#2b1d14" stroke-width="2.2" fill="rgba(200,230,255,.22)"><rect x="41" y="52.5" width="18" height="14" rx="6"/><rect x="61" y="52.5" width="18" height="14" rx="6"/></g>
        <path d="M59 58 Q60 56.5 61 58 M41 57 L34 55 M79 57 L86 55" stroke="#2b1d14" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M44 56 l4 -2.4 M64 56 l4 -2.4" stroke="#fff" stroke-width="1.6" opacity=".8" stroke-linecap="round"/>`;
      case 2: return `<g fill="#15171c" stroke="#000" stroke-width="1"><path d="M39 54 H59 V60 C59 66 54 68 49 68 C43 68 39 65 39 60Z"/><path d="M61 54 H81 V60 C81 65 77 68 71 68 C66 68 61 66 61 60Z"/></g>
        <path d="M59 56 Q60 55 61 56 M39 56 L33 54 M81 56 L87 54" stroke="#15171c" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <path d="M42 57.5 L50 57.5 M64 57.5 L72 57.5" stroke="#8fd3ff" stroke-width="1.8" opacity=".7" stroke-linecap="round"/>`;
      case 3: return `<path d="M31 47 C31 28 43 20 60 20 C77 20 89 28 89 47 Z" fill="#e85d3a" stroke="#9e3520" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M60 20 L60 47 M45 23 C42 31 41 39 42 47 M75 23 C78 31 79 39 78 47" stroke="#b8432a" stroke-width="1.2" fill="none" opacity=".7"/>
        <path d="M58 46 C74 43 96 44 106 50 C96 55 74 53 58 51Z" fill="#c4472a" stroke="#9e3520" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="60" cy="20.5" r="3" fill="#9e3520"/><path d="M38 33 Q46 25 56 24" stroke="#ffb199" stroke-width="2.2" fill="none" opacity=".5" stroke-linecap="round"/>`;
      case 4: return `<path d="M35 43 C35 26 45 19 60 19 C75 19 85 26 85 43 Z" fill="#4a5034" stroke="#272b19" stroke-width="1.6"/>
        <path d="M35 40 H85 V44 H35Z" fill="#2f3322"/>
        <path d="M22 47 C35 38 85 38 98 47 C85 53 35 53 22 47Z" fill="#3a3f2b" stroke="#272b19" stroke-width="1.6"/>
        <path d="M42 28 Q50 22 60 22" stroke="#7d8560" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/>`;
      case 5: return `<path d="M29 60 C29 30 41 20 60 20 C79 20 91 30 91 60" stroke="#24272e" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M33 54 C34 32 45 24 60 24" stroke="#5d6370" stroke-width="1.6" fill="none" opacity=".7"/>
        <rect x="22" y="51" width="13" height="20" rx="6" fill="#e85d3a" stroke="#9e3520" stroke-width="1.4"/><rect x="85" y="51" width="13" height="20" rx="6" fill="#e85d3a" stroke="#9e3520" stroke-width="1.4"/>
        <path d="M25 55 L25 66 M95 55 L95 66" stroke="#ffb199" stroke-width="1.8" opacity=".6" stroke-linecap="round"/>`;
      case 6: return `<path d="M39 36 L43 15 L52 27 L60 10 L68 27 L77 15 L81 36 Z" fill="#f2c94c" stroke="#9a7420" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M39 32 H81 V37 H39Z" fill="#d4a63a" stroke="#9a7420" stroke-width="1.4"/>
        <circle cx="60" cy="26" r="3.2" fill="#e2483d" stroke="#8e1b26" stroke-width="1"/><circle cx="47" cy="30" r="2" fill="#3d7be2"/><circle cx="73" cy="30" r="2" fill="#2fa36b"/>
        <path d="M45 18 l2 6" stroke="#fff6cf" stroke-width="1.6" opacity=".8" stroke-linecap="round"/>`;
      case 7: return `<path d="M12 45 L60 5 L108 45 C92 51 28 51 12 45Z" fill="#ead39a" stroke="#a8843c" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M32 29 C50 32 70 32 88 29 M22 38 C47 42 73 42 98 38 M44 19 C54 21 66 21 76 19" stroke="#b8954a" stroke-width="1.2" fill="none" opacity=".75"/>
        <path d="M60 5 L60 47" stroke="#c8a35a" stroke-width="1" opacity=".5"/>
        <path d="M30 46 C34 60 38 72 46 82 M90 46 C86 60 82 72 74 82" stroke="#a8843c" stroke-width="1.2" fill="none" opacity=".8"/>`;
      case 8: return `<path d="M73 30 L86 21 C89 25 89 35 86 39 Z M71 30 L58 21 C55 25 55 35 58 39 Z" fill="#ff5c8a" stroke="#b8264f" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M80 25 L84 30 M64 25 L60 30" stroke="#ffc2d4" stroke-width="1.4" opacity=".8" stroke-linecap="round"/>
        <ellipse cx="72" cy="30" rx="4" ry="4.6" fill="#e0436f" stroke="#b8264f" stroke-width="1.2"/>`;
      default: return '';
    }
  }

  const memo = new Map();
  /** Trả về chuỗi SVG nhân vật (có ghi nhớ). opts: { size, ring (màu viền), noBg } */
  function svg(cfg, opts = {}) {
    const c = normalize(cfg);
    const key = KEYS.map((k) => c[k]).join('') + '-' + (opts.size || 48) + (opts.ring || '') + (opts.noBg ? 'n' : '');
    let out = memo.get(key);
    if (!out) {
      out = draw(c, opts).replace('<svg class="avatar-svg"', `<svg class="avatar-svg" data-key="av${key}" data-morph-skip`);
      if (memo.size > 300) memo.clear();
      memo.set(key, out);
    }
    return out;
  }

  function draw(c, opts) {
    const size = opts.size || 48;
    const skin = SKIN[c.skin];
    const so = shade(skin, 0.74); // viền da
    const sd = shade(skin, 0.88); // bóng da
    const hair = HAIR_COLORS[c.hairColor];
    const bg = BG[c.bg];
    const hideHair = c.acc === 3 || c.acc === 4 || c.acc === 7;
    return `<svg class="avatar-svg" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
      <g>
        ${opts.noBg ? '' : `<rect width="120" height="120" fill="${shade(bg, 0.9)}"/><circle cx="60" cy="52" r="56" fill="${bg}"/><circle cx="44" cy="36" r="30" fill="#fff" opacity=".22"/>`}
        <g transform="translate(60 74) scale(1.1) translate(-60 -74)">
        ${hideHair ? (c.hair === 2 || c.hair === 5 ? hairBack(c.hair, hair) : '') : hairBack(c.hair, hair)}
        ${outfit(c.outfit, OUTFIT_COLORS[c.outfitColor], skin)}
        <path d="M52 78 L52 92 Q60 97 68 92 L68 78 Z" fill="${skin}" stroke="${so}" stroke-width="1.4"/>
        <path d="M52 81 Q60 89 68 81 L68 86 Q60 93 52 86 Z" fill="${sd}" opacity=".9"/>
        <circle cx="32.5" cy="60" r="6.4" fill="${skin}" stroke="${so}" stroke-width="1.4"/><circle cx="87.5" cy="60" r="6.4" fill="${skin}" stroke="${so}" stroke-width="1.4"/>
        <path d="M31 57.5 Q34 60 31.5 63 M89 57.5 Q86 60 88.5 63" stroke="${so}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
        <path d="M33 56 C33 38 45 29 60 29 C75 29 87 38 87 56 C87 73 78 86 60 87 C42 86 33 73 33 56 Z" fill="${skin}" stroke="${so}" stroke-width="1.6"/>
        <path d="M87 56 C87 73 78 86 60 87 C72 82 81 72 82.5 57 Z" fill="${sd}" opacity=".75"/>
        <ellipse cx="49" cy="42" rx="10" ry="5" fill="#fff" opacity=".2" transform="rotate(-12 49 42)"/>
        <ellipse cx="44.5" cy="69" rx="5.4" ry="3.2" fill="#ff7b7b" opacity=".32"/><ellipse cx="75.5" cy="69" rx="5.4" ry="3.2" fill="#ff7b7b" opacity=".32"/>
        ${brows(c.eyes, c.hair === 7 ? '#7a5a40' : hair)}
        ${eyes(c.eyes)}
        <path d="M59.4 63.5 Q62 66.6 58.6 68" stroke="${so}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        ${mouth(c.mouth)}
        ${hideHair ? (c.hair === 7 ? '' : `<path d="M33 52 C34 46 38 43 43 42 L77 42 C82 43 86 46 87 52 C80 47 70 46 60 46 C50 46 40 47 33 52Z" fill="${hair}" stroke="${shade(hair, 0.68)}" stroke-width="1.4"/>`) : hairFront(c.hair, hair)}
        ${accessory(c.acc)}
        </g>
      </g>
      ${opts.ring ? `<circle cx="60" cy="60" r="56" fill="none" stroke="${opts.ring}" stroke-width="7"/>` : ''}
    </svg>`;
  }

  window.Avatar = { OPTIONS, KEYS, normalize, random, svg, SKIN, HAIR_COLORS, OUTFIT_COLORS, BG };
})();
