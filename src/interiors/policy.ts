// Pul-kredit siyosati o‘quv modeli (soddalashtirilgan, 3 tenglamali, choraklik).
// Namunaviy parametrlar — real prognoz emas, MPC simulyatsiyasi g‘oyasini ko‘rsatish uchun.

export type ShockId = 'inflation' | 'fx' | 'commodity' | 'food' | 'fiscal' | 'external';

export const SHOCKS: Record<ShockId, { label: string; pi?: number[]; y?: number[]; e?: number[] }> = {
  inflation: { label: 'Inflyatsiya shoki', pi: [2.0, 1.2, 0.6, 0.3] },
  fx: { label: 'Valyuta kursi qadrsizlanishi', e: [22, 9, 4, 1] },
  commodity: { label: 'Xomashyo narxlari shoki', pi: [1.3, 0.9, 0.5, 0.2], y: [-0.3, -0.3, -0.2] },
  food: { label: 'Oziq-ovqat inflyatsiyasi shoki', pi: [1.8, 1.0, 0.4, 0.1] },
  fiscal: { label: 'Fiskal kengayish', y: [0.8, 0.8, 0.6, 0.4, 0.2] },
  external: { label: 'Tashqi talab shoki', y: [-1.1, -0.9, -0.6, -0.3], e: [7, 3, 1] },
};

export const MODEL = {
  target: 5,
  rStar: 4,
  pi0: 8.5,
  y0: 0.3,
  i0: 14,
  horizon: 12,
};

export interface PolicyResult {
  q: number[];
  pi: number[];
  y: number[];
  i: number[];
  taylorRate: number;
  loss: number;
  taylorLoss: number;
  verdict: string;
  tone: 'ok' | 'loose' | 'tight';
}

function simulate(shock: ShockId, size: number, firstYearRate: number | null): Omit<PolicyResult, 'taylorRate' | 'taylorLoss' | 'verdict' | 'tone'> {
  const s = SHOCKS[shock];
  const { target, rStar, pi0, y0, i0, horizon } = MODEL;
  const pi = [pi0];
  const y = [y0];
  const i = [i0];
  const at = (arr: number[] | undefined, t: number) => (arr && arr[t - 1] !== undefined ? arr[t - 1] * size : 0);
  let loss = 0;
  for (let t = 1; t <= horizon; t++) {
    // kutilmalar qisman maqsadga bog‘langan
    const piE = 0.72 * pi[t - 1] + 0.28 * target;
    // kurs: shok minus foiz farqi ta’siri
    const de = at(s.e, t) - 0.35 * (i[t - 1] - (rStar + piE));
    // IS: real stavka neytraldan yuqori bo‘lsa, talab pasayadi
    const yt = 0.72 * y[t - 1] - 0.16 * (i[t - 1] - piE - rStar) + at(s.y, t);
    // Phillips egri chizig‘i + kurs ta’siri (pass-through)
    const pit = 0.5 * pi[t - 1] + 0.5 * piE + 0.28 * y[t - 1] + 0.1 * Math.max(-6, de) + at(s.pi, t);
    let it: number;
    const taylor = rStar + pit + 0.5 * (pit - target) + 0.5 * yt;
    if (firstYearRate !== null && t <= 4) it = firstYearRate;
    else it = 0.7 * i[t - 1] + 0.3 * taylor;
    pi.push(pit);
    y.push(yt);
    i.push(it);
    loss += (pit - target) ** 2 + 0.5 * yt * yt + 0.1 * (it - i[t - 1]) ** 2;
  }
  return { q: Array.from({ length: horizon + 1 }, (_, k) => k), pi, y, i, loss };
}

export function runPolicy(shock: ShockId, size: number, rate: number): PolicyResult {
  const r = simulate(shock, size, rate);
  const tay = simulate(shock, size, null);
  // birinchi chorak uchun Taylor qoidasi tavsiyasi
  const { target, rStar } = MODEL;
  const taylorRate = rStar + tay.pi[1] + 0.5 * (tay.pi[1] - target) + 0.5 * tay.y[1];
  const pi8 = r.pi[8];
  const yMin = Math.min(...r.y.slice(1));
  let verdict: string;
  let tone: PolicyResult['tone'];
  if (pi8 > target + 1) {
    tone = 'loose';
    verdict = 'Siyosat yumshoq: 2 yildan keyin ham inflyatsiya maqsaddan yuqori. Stavkani oshirishni ko‘rib chiqing.';
  } else if (pi8 < target - 1 || yMin < -2) {
    tone = 'tight';
    verdict = 'Siyosat haddan qattiq: ishlab chiqarish uzilishi chuqur yoki inflyatsiya maqsaddan pastga tushdi.';
  } else {
    tone = 'ok';
    verdict = 'Muvozanatli qaror: inflyatsiya 2 yil ichida maqsadga yaqinlashdi, o‘sishga zarar cheklangan.';
  }
  return { ...r, taylorRate, taylorLoss: tay.loss, verdict, tone };
}

export interface ChartTheme {
  surface: string;
  ink: string;
  ink2: string;
  grid: string;
  inflation: string;
  rate: string;
  gap: string;
  target: string;
  font: string;
  mono: string;
}

/**
 * Ikki panel: yuqorida inflyatsiya va stavka (bitta % o‘qi), pastda ishlab chiqarish uzilishi.
 * hover — tanlangan chorak (krestik va qiymatlar).
 */
export function drawPolicyChart(
  ctx: CanvasRenderingContext2D, W: number, H: number, r: PolicyResult, th: ChartTheme,
  opts: { scale?: number; hover?: number | null; title?: string } = {},
) {
  const k = opts.scale ?? 1;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = th.surface;
  ctx.fillRect(0, 0, W, H);
  const padL = 44 * k;
  const padR = 122 * k;
  const top0 = (opts.title ? 40 : 14) * k;
  const gapH = 10 * k;
  const bottom = 26 * k;
  const plotH = H - top0 - bottom - gapH;
  const h1 = plotH * 0.66;
  const h2 = plotH - h1;
  const y1top = top0;
  const y2top = top0 + h1 + gapH;
  const n = r.q.length - 1;
  const xOf = (q: number) => padL + (q / n) * (W - padL - padR);

  if (opts.title) {
    ctx.fillStyle = th.ink;
    ctx.font = `600 ${15 * k}px ${th.font}`;
    ctx.textBaseline = 'top';
    ctx.fillText(opts.title, padL, 12 * k);
  }

  // --- yuqori panel: %
  const vals = [...r.pi, ...r.i, MODEL.target];
  const lo = Math.floor(Math.min(...vals) - 1);
  const hi = Math.ceil(Math.max(...vals) + 1);
  const yOf = (v: number) => y1top + h1 - ((v - lo) / (hi - lo)) * h1;
  ctx.font = `${11 * k}px ${th.mono}`;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1 * k;
  const stepV = hi - lo > 12 ? 4 : 2;
  for (let v = Math.ceil(lo / stepV) * stepV; v <= hi; v += stepV) {
    ctx.strokeStyle = th.grid;
    ctx.beginPath();
    ctx.moveTo(padL, yOf(v));
    ctx.lineTo(W - padR, yOf(v));
    ctx.stroke();
    ctx.fillStyle = th.ink2;
    ctx.textAlign = 'right';
    ctx.fillText(`${v}%`, padL - 6 * k, yOf(v));
  }
  // maqsad chizig‘i
  ctx.setLineDash([5 * k, 4 * k]);
  ctx.strokeStyle = th.target;
  ctx.beginPath();
  ctx.moveTo(padL, yOf(MODEL.target));
  ctx.lineTo(W - padR, yOf(MODEL.target));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = th.ink2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('maqsad 5%', padL + 6 * k, yOf(MODEL.target) - 3 * k);
  ctx.textBaseline = 'middle';

  const line = (arr: number[], color: string, step = false) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * k;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    arr.forEach((v, q) => {
      const x = xOf(q);
      const y = yOf(v);
      if (q === 0) ctx.moveTo(x, y);
      else if (step) {
        ctx.lineTo(x, yOf(arr[q - 1]));
        ctx.lineTo(x, y);
      } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // oxirgi nuqta va to‘g‘ridan-to‘g‘ri yorliq
    const x = xOf(n);
    const y = yOf(arr[n]);
    ctx.fillStyle = th.surface;
    ctx.beginPath();
    ctx.arc(x, y, 5 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4 * k, 0, Math.PI * 2);
    ctx.fill();
  };
  line(r.i, th.rate, true);
  line(r.pi, th.inflation);
  // yorliqlar (to‘qnashmasligi uchun ajratamiz)
  let yi = yOf(r.pi[n]);
  let yr = yOf(r.i[n]);
  if (Math.abs(yi - yr) < 14 * k) {
    if (yi < yr) { yi -= 7 * k; yr += 7 * k; } else { yi += 7 * k; yr -= 7 * k; }
  }
  ctx.font = `600 ${11.5 * k}px ${th.font}`;
  ctx.fillStyle = th.ink;
  ctx.textAlign = 'left';
  ctx.fillText(`Inflyatsiya ${r.pi[n].toFixed(1)}%`, W - padR + 8 * k, yi);
  ctx.fillText(`Stavka ${r.i[n].toFixed(1)}%`, W - padR + 8 * k, yr);

  // --- pastki panel: ishlab chiqarish uzilishi
  const gmax = Math.max(1, Math.ceil(Math.max(...r.y.map(Math.abs))));
  const gy = (v: number) => y2top + h2 / 2 - (v / gmax) * (h2 / 2 - 4 * k);
  ctx.strokeStyle = th.grid;
  ctx.lineWidth = 1 * k;
  ctx.beginPath();
  ctx.moveTo(padL, gy(0));
  ctx.lineTo(W - padR, gy(0));
  ctx.stroke();
  ctx.font = `${11 * k}px ${th.mono}`;
  ctx.fillStyle = th.ink2;
  ctx.textAlign = 'right';
  ctx.fillText(`+${gmax}`, padL - 6 * k, gy(gmax));
  ctx.fillText('0', padL - 6 * k, gy(0));
  ctx.fillText(`−${gmax}`, padL - 6 * k, gy(-gmax));
  const bw = Math.max(3 * k, ((W - padL - padR) / n) * 0.5);
  let minQ = 1;
  r.y.forEach((v, q) => {
    if (q === 0) return;
    if (v < r.y[minQ]) minQ = q;
    const x = xOf(q) - bw / 2;
    const y0 = gy(0);
    const y = gy(v);
    ctx.fillStyle = th.gap;
    const hgt = Math.max(1, Math.abs(y - y0));
    const rad = Math.min(4 * k, hgt / 2, bw / 2);
    ctx.beginPath();
    if (v >= 0) ctx.roundRect(x, y, bw, hgt, [rad, rad, 0, 0]);
    else ctx.roundRect(x, y0, bw, hgt, [0, 0, rad, rad]);
    ctx.fill();
  });
  ctx.font = `600 ${11.5 * k}px ${th.font}`;
  ctx.fillStyle = th.ink;
  ctx.textAlign = 'left';
  ctx.fillText('Uzilish (y)', W - padR + 8 * k, gy(0));
  ctx.font = `${10.5 * k}px ${th.mono}`;
  ctx.fillStyle = th.ink2;
  ctx.textAlign = 'center';
  const mv = r.y[minQ];
  ctx.fillText(`${mv.toFixed(1)}`, xOf(minQ), mv < 0 ? gy(mv) + 9 * k : gy(mv) - 9 * k);

  // x o‘qi
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = th.ink2;
  ctx.font = `${10.5 * k}px ${th.mono}`;
  const xStep = W / k < 520 ? 4 : 2;
  for (let q = 0; q <= n; q += xStep) ctx.fillText(q === 0 ? 'hozir' : `${q}-chorak`, xOf(q), H - bottom + 8 * k);

  // hover
  if (opts.hover !== null && opts.hover !== undefined) {
    const q = Math.max(0, Math.min(n, opts.hover));
    const x = xOf(q);
    ctx.strokeStyle = th.ink2;
    ctx.lineWidth = 1 * k;
    ctx.beginPath();
    ctx.moveTo(x, y1top);
    ctx.lineTo(x, y2top + h2);
    ctx.stroke();
    const lines = [
      q === 0 ? 'Hozirgi holat' : `${q}-chorak`,
      `Inflyatsiya: ${r.pi[q].toFixed(1)}%`,
      `Stavka: ${r.i[q].toFixed(2)}%`,
      `Uzilish: ${r.y[q].toFixed(2)}%`,
    ];
    ctx.font = `${11.5 * k}px ${th.font}`;
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16 * k;
    const tbH = lines.length * 16 * k + 10 * k;
    const tx = x + 10 * k + tw > W ? x - 10 * k - tw : x + 10 * k;
    const ty = y1top + 4 * k;
    ctx.fillStyle = th.surface;
    ctx.strokeStyle = th.grid;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, tbH, 6 * k);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, j) => {
      ctx.fillStyle = j === 0 ? th.ink : th.ink2;
      ctx.font = `${j === 0 ? '600 ' : ''}${11.5 * k}px ${th.font}`;
      ctx.fillText(l, tx + 8 * k, ty + 6 * k + j * 16 * k);
    });
    [th.inflation, th.rate].forEach((c, j) => {
      const v = j === 0 ? r.pi[q] : r.i[q];
      ctx.fillStyle = th.surface;
      ctx.beginPath();
      ctx.arc(x, yOf(v), 5.5 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, yOf(v), 4.5 * k, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}
