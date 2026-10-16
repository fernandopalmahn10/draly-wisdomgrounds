// DralingoCast — the gang of every episode (his vision 2026-10-11: "like Scooby-Doo, every class is a new episode").
// Who's who, their sticker poses and their lines. Show bible: claude-setup/cast.md (root repo).
//   DralingoCast.pick(2)                 → two random character ids (a new combination each time)
//   DralingoCast.pose('aileen', 'cheer') → '/assets/cast/aileen-cheer.webp'
//   DralingoCast.line('aileen', 'win')   → '¡Vos podés! ¡Lo hiciste!'   (Aileen speaks Argentine Spanish, voseo)
//   DralingoCast.captain('aileen')       → 'Capitana Aileen'   (Reinos de Colores; moods: hello, win, battle, mystery, oops)
//   moods: hello, win, battle (Reinos: flags, conquest), chase (La Gran Fuga: running from Robotín, turbos, the jet),
//   feast (Mochi Mash: feeding the Dragoncito), smash (Piñata Tigre: hitting the piñata), swing (6-7 Swing: the golden
//   balance), oro (6-7 Swing: the winners), casi (6-7 Swing: the team that lost, kindly), mystery, oops,
//   ruta (La Ruta Dorada /audios/<level>: a friend cheers the kid along the path of three levels)
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
        chase: ['¡Vamos, equipo! ¡Turbos!', '¡Nadie se queda atrás!', '¡Cada respuesta nos aleja de Robotín!'],
        feast: ['¡Respondan y alimenten al dragoncito!', '¡Eso es trabajo en equipo!', '¡Qué hambre tiene ese dragoncito!'],
        smash: ['¡Dale a esa piñata!', '¡Golpe en el dorado, equipo!', '¡Qué golpazo!'],
        fiesta: ['¡Piñata rota! Excelente trabajo.', '¡Así se aprende y así se celebra!', '¡Equipo de campeones!'],
        swing: ['¡Seis o siete: piensa y toca!', '¡Esa balanza está bajando, equipo!', '¡Liu, qi! ¡Muy bien!'],
        oro: ['¡La balanza es de ustedes! Excelente trabajo.', '¡Así se cuenta en Chino Mandarín!', '¡Equipo de campeones!'],
        casi: ['¡Casi! La próxima ronda es nuestra.', 'Buen esfuerzo, equipo. ¡A la revancha!'],
        ruta: ['Paso a paso se llega al oro.', 'Primero La Base. Después, el examen.', 'Un poco cada día, ¡y llegas!'],
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
        chase: ['¡Yalla, yalla! ¡Al jet!', '¡El jet los espera, amigos!', '¡Yalla, más rápido!'],
        feast: ['¡Yalla, más mochis!', '¡Marhaba, dragoncito! ¡A comer!', '¡Yalla, yalla, que no pare!'],
        smash: ['¡Yalla, golpe fuerte!', '¡Yalla, yalla, rompan la piñata!', '¡Marhaba, caramelos!'],
        fiesta: ['¡Yalla! ¡Caramelos para todos!', '¡Increíble, equipo!', '¡Esta fiesta merece un viaje en jet!'],
        swing: ['¡Yalla, más oro!', '¡Yalla, yalla, liu qi!', '¡Marhaba, monedas de oro!'],
        oro: ['¡Yalla! ¡Oro para todos!', '¡Increíble, equipo!', '¡Esa balanza merece un viaje en jet!'],
        casi: ['¡Yalla, la revancha es nuestra!', 'Casi, amigos. ¡Otra ronda!'],
        ruta: ['¡Yalla, a la Ruta Dorada!', '¡Yalla, un sello más!', 'Al final de la ruta, ¡el oro!'],
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
        chase: ['¡Sepárense y lo logramos!', '¡Buena estrategia, equipo!', 'Piensen rápido: ¡turbo!'],
        feast: ['Respuesta correcta, mochi asegurado.', 'Cada mochi cuenta, equipo.', '¡Buena estrategia: respondan rápido!'],
        smash: ['Miren la flecha y toquen en el dorado.', 'Paciencia… ¡ahora!', '¡Golpe perfecto, equipo!'],
        fiesta: ['¡Brillante! La piñata no tuvo oportunidad.', '¡Así se piensa y así se golpea!', '¡Yalla, a la siguiente piñata!'],
        swing: ['Primero piensa, después toca.', 'Una racha vale más oro.', '¡Buena cuenta, equipo!'],
        oro: ['¡Brillante! Pensaron antes de tocar.', '¡La balanza no miente!', '¡Yalla, a la siguiente ronda!'],
        casi: ['Casi. La próxima vez, primero pensamos.', 'La próxima balanza es nuestra.'],
        ruta: ['Buena estrategia: primero La Base.', 'Cada sello es una pista para el examen.', 'Con calma y cada día, se llega.'],
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
        chase: ['¡Dale, che, corré!', '¡Vos podés, dale turbo!', '¡Dale, que se acerca Robotín!'],
        feast: ['¡Dale, che, más mochis!', '¡Vos podés, tocá rápido!', '¡Qué genial, che, cómo come!'],
        smash: ['¡Dale, che, pegale fuerte!', '¡Vos podés, tocá en el dorado!', '¡Qué golpazo, che!'],
        fiesta: ['¡Vos podés! ¡La rompimos!', '¡Qué genial, che!', '¡Dale, otra piñata más!'],
        swing: ['¡Dale, che, tocá el bueno!', '¡Vos sabés: seis o siete!', '¡Qué genial, che, cuánto oro!'],
        oro: ['¡Vos podés! ¡Ganamos el oro!', '¡Qué genial, che!', '¡Dale, otra ronda más!'],
        casi: ['¡Casi, che! La próxima es nuestra.', 'Tranqui, ¡vos podés! Dale, otra ronda.'],
        ruta: ['¡Dale, che! Un sello por día.', '¡Vos podés llegar al oro!', 'Mirá tu ruta: ¡vamos paso a paso!'],
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
        chase: ['Mi perro corre más rápido. ¡Vamos!', 'Por ahí. Rápido.', 'Bien. Sigan así.'],
        feast: ['Mi perro también quiere mochis.', 'Rápido. Toca.', 'Bien. Que coma.'],
        smash: ['Mi perro quiere caramelos.', 'Espera… ahora.', 'Buen golpe.'],
        fiesta: ['Bien hecho. Mi perro está feliz.', 'Nada mal, equipo.', '¡Eso fue genial!'],
        swing: ['Mi perro sabe contar hasta siete.', 'Piensa. Toca.', 'Bien. Más oro.'],
        oro: ['Bien hecho. Mi perro está feliz.', 'Nada mal, equipo.', '¡Eso fue genial!'],
        casi: ['Casi. Mi perro cree en ustedes.', 'Otra ronda. Esta vez sí.'],
        ruta: ['Paso a paso.', 'Mi perro ya sigue la ruta.', 'Sígueme. Por aquí.'],
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
        chase: ['¡El mapa dice: por aquí!', '¡Ya casi llegamos!', '¡A la aventura, rápido!'],
        feast: ['¡El mapa dice: más mochis!', '¡A la aventura, a comer!', '¡Vamos por el Burj Khalifa!'],
        smash: ['¡El mapa dice: caramelos!', '¡A la aventura, a golpear!', '¡Vamos por el tigre de oro!'],
        fiesta: ['¡Tesoro de caramelos!', '¡Misión cumplida!', '¡Lo logramos juntos!'],
        swing: ['¡El mapa dice: más oro!', '¡A la aventura, liu qi!', '¡Vamos por el Burj Khalifa!'],
        oro: ['¡Tesoro de oro!', '¡Misión cumplida!', '¡Lo logramos juntos!'],
        casi: ['¡El tesoro sigue ahí! Otra ronda.', '¡Casi lo encontramos!'],
        ruta: ['¡El mapa dice: primero La Base!', '¡El tesoro está al final de la ruta!', '¡A la aventura, paso a paso!'],
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
        chase: ['¡Turbo!', '¡A correr!', '¡Yalla!'],
        feast: ['¡Ñam!', '¡Más mochis!', '¡Yalla!'],
        smash: ['¡Pum!', '¡Caramelos!', '¡Yalla!'],
        fiesta: ['¡Lo logramos!', '¡Qué fiesta, amigos!', '¡Bien hecho!'],
        swing: ['¡Liu, qi!', '¡Seis-siete!', '¡Yalla!'],
        oro: ['¡Liu, qi! ¡Lo logramos!', '¡Qué balanza, amigos!', '¡Bien hecho!'],
        casi: ['¡Casi, amigos! ¡Otra ronda!', 'Los dragones nunca se rinden.'],
      },
    },
  };
  const HUMANS = ['fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian'];
  const MOOD_POSE = { hello: 'hello', win: 'cheer', good: 'cheer', battle: 'cheer', chase: 'cheer', feast: 'cheer', smash: 'cheer', fiesta: 'cheer', swing: 'cheer', oro: 'cheer', casi: 'hello', ruta: 'hello', mystery: 'mystery', oops: 'mystery' };
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
