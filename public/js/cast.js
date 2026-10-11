// DralingoCast — the gang of every episode (his vision 2026-10-11: "like Scooby-Doo, every class is a new episode").
// Who's who, their sticker poses and their lines. Show bible: claude-setup/cast.md (root repo).
//   DralingoCast.pick(2)                 → two random character ids (a new combination each time)
//   DralingoCast.pose('aileen', 'cheer') → '/assets/cast/aileen-cheer.webp'
//   DralingoCast.line('aileen', 'win')   → '¡Vos podés! ¡Lo hiciste!'   (Aileen speaks Argentine Spanish, voseo)
//   DralingoCast.captain('aileen')       → 'Capitana Aileen'   (Reinos de Colores; moods: hello, win, battle, mystery, oops)
// Poses: hello, cheer, mystery. Stickers are Higgsfield renders of his own character art, keyed to transparent WebP.
(function () {
  const BASE = '/assets/cast/';
  const D = '/assets/kingdoms/dralingo/';
  const CAST = {
    fer: {
      name: 'Profe Fer', role: 'el profe',
      lines: {
        hello: ['¡Bienvenidos a un nuevo episodio!', '¡Atención, equipo! Tenemos una misión.', '¡Hola, detectives!'],
        win: ['¡Caso resuelto! Excelente trabajo.', '¡Así se aprende! Bien hecho.', '¡Equipo de campeones!'],
        mystery: ['Algo raro pasa en Dubái… ¿lo resolvemos?', 'Cada respuesta es una pista.', 'Escuchen bien: aquí hay un misterio.'],
        oops: ['Casi. ¡Inténtalo otra vez!', 'Pensemos juntos…'],
        battle: ['¡Vamos, equipo! ¡A conquistar!', '¡Esa bandera, bien plantada!', '¡Así se juega!'],
      },
    },
    hamdan: {
      name: 'Hamdan', role: 'el capitán',
      lines: {
        hello: ['¡Marhaba! Bienvenidos a Dubái.', '¡Marhaba, amigos!', '¡Yalla, empieza la aventura!'],
        win: ['¡Yalla! ¡Lo lograron!', '¡Increíble, equipo!', '¡Eso merece un viaje en jet!'],
        mystery: ['Mmm… aquí hay una pista.', '¿Qué será esto?', '¡Miren esto, detectives!'],
        oops: ['No pasa nada. ¡Yalla, otra vez!', 'Casi, amigo. ¡Otra vez!'],
        battle: ['¡Yalla, yalla! ¡Vamos!', '¡Dubái es nuestro!', '¡A conquistar, amigos!'],
      },
    },
    latifa: {
      name: 'Latifa', role: 'la estratega', fem: true,
      lines: {
        hello: ['¡Marhaba! Hoy tenemos un misterio.', '¡Hola, equipo! ¿Listos?', 'Bienvenidos a bordo.'],
        win: ['¡Pista resuelta!', '¡Brillante! Así se piensa.', '¡Yalla, al siguiente misterio!'],
        mystery: ['Cada palabra es una pista.', 'Si unimos las pistas, lo resolvemos.', 'Pensemos con calma…'],
        oops: ['Casi… revisemos la pista.', 'Tranquilos, lo intentamos de nuevo.'],
        battle: ['¡Rodeen esa zona!', '¡Buena estrategia, equipo!', '¡Vamos por los monumentos!'],
      },
    },
    aileen: {
      name: 'Aileen', role: 'la valiente', fem: true,
      lines: {   // Argentine Spanish (voseo), always
        hello: ['¡Hola! ¿Vos estás listo?', '¡Dale, que arrancamos!', '¡Qué bueno verte, che!'],
        win: ['¡Vos podés! ¡Lo hiciste!', '¡Qué genial, che!', '¡Dale, otra más!'],
        mystery: ['¿Viste eso? ¡Una pista!', 'Mirá, acá hay algo raro…', '¡Vamos a averiguarlo!'],
        oops: ['¡Casi! Dale, otra vez.', 'Tranqui, ¡vos podés!'],
        battle: ['¡Dale, che, vamos!', '¡Vos podés, plantá esa bandera!', '¡Vamos, vamos, que ganamos!'],
      },
    },
    adric: {
      name: 'Adric', role: 'el rastreador',
      lines: {
        hello: ['Hola… ¿empezamos?', 'Mi perro ya encontró una pista.', 'Sígueme.'],
        win: ['Bien hecho.', 'Nada mal, equipo.', '¡Eso fue genial!'],
        mystery: ['Mira… huellas.', 'Mi perro huele algo.', 'Silencio… escucha.'],
        oops: ['Casi.', 'Otra vez. Tú puedes.'],
        battle: ['Bien. Sigan así.', 'Mi perro huele la victoria.', 'Por ahí. Rápido.'],
      },
    },
    adrian: {
      name: 'Adrian', role: 'el explorador',
      lines: {
        hello: ['¡A la aventura!', '¡Por aquí, equipo!', '¡Tengo el mapa!'],
        win: ['¡Tesoro encontrado!', '¡Misión cumplida!', '¡Lo logramos juntos!'],
        mystery: ['El mapa dice que es por aquí…', '¿Adónde lleva esta pista?', '¡Una X en el mapa!'],
        oops: ['¡Seguimos buscando!', 'El tesoro está cerca. ¡Otra vez!'],
        battle: ['¡El mapa dice: por aquí!', '¡A la aventura, equipo!', '¡Vamos por el tesoro!'],
      },
    },
    dralingo: {
      name: 'Dralingo', role: 'el corazón del equipo',
      poses: { hello: D + 'wave.webp', cheer: D + 'party.webp', mystery: D + 'thinking.webp' },
      lines: {
        hello: ['¡Hola!', '¡A jugar!', '¡Qué bueno verte!'],
        win: ['¡Lo logramos!', '¡Vamos!', '¡Bien hecho!'],
        mystery: ['¿Y esto qué es?', '¡Una pista!', 'Mmm…'],
        oops: ['¡Casi!', '¡Otra vez!'],
        battle: ['¡Vamos!', '¡A conquistar!', '¡Yalla!'],
      },
    },
  };
  const HUMANS = ['fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian'];
  const MOOD_POSE = { hello: 'hello', win: 'cheer', good: 'cheer', battle: 'cheer', mystery: 'mystery', oops: 'mystery' };
  const pick1 = (a) => a[Math.floor(Math.random() * a.length)];

  function pick(n, opts) {
    const ex = (opts && opts.exclude) || [];
    const pool = ((opts && opts.withDralingo) ? HUMANS.concat('dralingo') : HUMANS).filter((id) => !ex.includes(id));
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  function pose(id, p) {
    const c = CAST[id] || CAST.dralingo;
    const key = MOOD_POSE[p] || p || 'hello';
    if (c.poses) return c.poses[key] || c.poses.hello;
    return BASE + id + '-' + key + '.webp';
  }
  function line(id, mood) {
    const c = CAST[id] || CAST.dralingo;
    const m = mood === 'good' ? 'win' : mood;
    return pick1(c.lines[m] || c.lines.hello);
  }

  window.DralingoCast = {
    ids: HUMANS.slice(),
    name: (id) => (CAST[id] || CAST.dralingo).name,
    role: (id) => (CAST[id] || CAST.dralingo).role,
    fem: (id) => !!(CAST[id] || {}).fem,
    captain: (id) => ((CAST[id] || {}).fem ? 'Capitana ' : 'Capitán ') + (CAST[id] || CAST.dralingo).name,
    pick,
    pose,
    line,
  };
})();
