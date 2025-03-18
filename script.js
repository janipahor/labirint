document.addEventListener("DOMContentLoaded", () => {
  const scale = 1.2;
  const ORIG_SIZE = 484;
  // 484 * 1.2 = ~580.8 -> zaokroženo na 580 v CSS
  const NEW_SIZE = 580;

  let walls = [];
  // Naložimo in raztegnemo maze.svg
  fetch("maze.svg")
    .then(res => res.text())
    .then(svgData => {
      const mazeWrapper = document.getElementById("mazeWrapper");
      mazeWrapper.insertAdjacentHTML("afterbegin", svgData);

      const svgEl = mazeWrapper.querySelector("svg");
      svgEl.setAttribute("viewBox", `0 0 ${ORIG_SIZE} ${ORIG_SIZE}`);

      const lineElems = svgEl.querySelectorAll("line");
      lineElems.forEach(ln => {
        let x1 = parseFloat(ln.getAttribute("x1"));
        let y1 = parseFloat(ln.getAttribute("y1"));
        let x2 = parseFloat(ln.getAttribute("x2"));
        let y2 = parseFloat(ln.getAttribute("y2"));
        // Množimo s scale
        walls.push({
          x1: x1 * scale,
          y1: y1 * scale,
          x2: x2 * scale,
          y2: y2 * scale
        });
      });
    })
    .catch(err => console.error("Napaka pri nalaganju SVG:", err));

  // Pridobimo elemente gumbov, spustnega seznama in gumba za preklop glasbe
  const btnShow = document.getElementById("btnShow");
  const btnHide = document.getElementById("btnHide");
  const btnInfo = document.getElementById("btnInfo");
  const btnReset = document.getElementById("btnReset");
  const musicSelector = document.getElementById("musicSelector");
  const toggleMusic = document.getElementById("toggleMusic");
  const bgMusic = document.getElementById("bgMusic");

  // Show/Hide rešitve
  btnShow.addEventListener("click", () => {
    const solPath = document.querySelector(".solution-path");
    if (solPath) solPath.classList.add("draw");
    btnShow.style.display = "none";
    btnHide.style.display = "inline-block";
  });
  btnHide.addEventListener("click", () => {
    const solPath = document.querySelector(".solution-path");
    if (solPath) solPath.classList.remove("draw");
    btnHide.style.display = "none";
    btnShow.style.display = "inline-block";
  });

  // Info => SweetAlert
  btnInfo.addEventListener("click", () => {
    Swal.fire({
      icon: "info",
      title: "How to Play",
      html: `
        <ul style="text-align:left;">
          <li>Pomikaj meteorite s tipkami <b>W, A, S, D</b>.</li>
          <li>Če se dotakneš stene: <em>Game Over</em>.</li>
          <li>Gumb "Show Solution" prikaže pot.</li>
          <li>Izhod je v spodnjem delu labirinta.</li>
        </ul>
        <p>Veliko uspeha!</p>
      `,
      confirmButtonText: "Zapri"
    });
  });

  // Reset
  btnReset.addEventListener("click", () => {
    resetAll();
  });

  // Spustni seznam za izbiro glasbe
  musicSelector.addEventListener("change", () => {
    const selectedTrack = musicSelector.value;
    if (selectedTrack) {
      bgMusic.src = selectedTrack;
      bgMusic.play().then(() => {
        toggleMusic.style.display = "block";
        toggleMusic.textContent = "Stop Music";
      }).catch(err => {
        console.log("Napaka pri predvajanju glasbe:", err);
        alert("Glasbe ni mogoče predvajati. Preverite nastavitve zvoka ali dovoljenja!");
      });
    } else {
      bgMusic.pause();
      toggleMusic.style.display = "none";
    }
  });

  // Gumb za preklop predvajanja/ustavljanja glasbe
  toggleMusic.addEventListener("click", () => {
    if (bgMusic.paused) {
      bgMusic.play().then(() => {
        toggleMusic.textContent = "Stop Music";
      }).catch(err => {
        console.log("Napaka pri predvajanju glasbe:", err);
      });
    } else {
      bgMusic.pause();
      toggleMusic.textContent = "Play Music";
    }
  });

  // Meteorite & risanje
  const meteoriteImg = document.getElementById("meteorite");
  const drawCanvas = document.getElementById("drawCanvas");
  const ctx = drawCanvas.getContext("2d");

  // Polmer meteorita
  const METEOR_RADIUS = 7;
  // Začetna pozicija: npr. (234, 10) * scale => (280.8, 12)
  let meteoritePos = { x: 234 * scale, y: 10 * scale };

  // Hitrost
  let vx = 0, vy = 0;
  const SPEED = 2.5;

  // Črta za sledenje
  let lastX = meteoritePos.x;
  let lastY = meteoritePos.y;

  function updateMeteoritePosition() {
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(meteoritePos.x, meteoritePos.y);
    ctx.strokeStyle = "rgb(77, 77, 255)";
    ctx.shadowColor = "rgba(77, 77, 255, 0.8)";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastX = meteoritePos.x;
    lastY = meteoritePos.y;

    meteoriteImg.style.left = (meteoritePos.x - METEOR_RADIUS) + "px";
    meteoriteImg.style.top = (meteoritePos.y - METEOR_RADIUS) + "px";
  }

  // Kolizijska detekcija
  function lineCircleCollides(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return Math.hypot(cx - x1, cy - y1) <= r;
    const t = ((cx - x1) * dx + (cy - y1) * dy) / lengthSq;
    const tClamped = Math.max(0, Math.min(1, t));
    const closestX = x1 + tClamped * dx;
    const closestY = y1 + tClamped * dy;
    const distanceSq = (closestX - cx) ** 2 + (closestY - cy) ** 2;
    return distanceSq <= r * r;
  }

  function canMoveTo(newX, newY) {
    if (newX < 0 || newX > NEW_SIZE || newY < 0 || newY > NEW_SIZE) return false;
    for (let w of walls) {
      if (lineCircleCollides(w.x1, w.y1, w.x2, w.y2, newX, newY, METEOR_RADIUS)) return false;
    }
    if (newY >= 578 && newX >= 290 && newX <= 310) {
      youWin();
      return false;
    }
    return true;
  }

  function gameLoop() {
    if (vx !== 0 || vy !== 0) {
      let newX = meteoritePos.x + vx;
      let newY = meteoritePos.y + vy;
      if (canMoveTo(newX, newY)) {
        meteoritePos.x = newX;
        meteoritePos.y = newY;
        updateMeteoritePosition();
      }
    }
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);

  // Tipke
  let keysPressed = {};
  document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (["w", "a", "s", "d"].includes(key)) {
      keysPressed[key] = true;
      e.preventDefault();
    }
    updateVelocity();
  });
  document.addEventListener("keyup", (e) => {
    const key = e.key.toLowerCase();
    if (keysPressed[key]) {
      keysPressed[key] = false;
      e.preventDefault();
    }
    updateVelocity();
  });

  function updateVelocity() {
    vx = 0;
    vy = 0;
    if (keysPressed["w"]) vy = -SPEED;
    if (keysPressed["s"]) vy = SPEED;
    if (keysPressed["a"]) vx = -SPEED;
    if (keysPressed["d"]) vx = SPEED;
  }

  // Game Over / Win
  function gameOver() {
    Swal.fire({
      icon: "error",
      title: "Game Over",
      text: "Zadeli ste steno labirinta!",
      confirmButtonText: "Ok"
    }).then(() => resetAll());
  }
  function youWin() {
    Swal.fire({
      icon: "success",
      title: "You Win!",
      text: "Uspešno ste prišli do izhoda labirinta!",
      confirmButtonText: "Super"
    }).then(() => resetAll());
  }

  function resetAll() {
    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    meteoritePos = { x: 234 * scale, y: 10 * scale };
    lastX = meteoritePos.x;
    lastY = meteoritePos.y;
    vx = 0;
    vy = 0;
    updateMeteoritePosition();
    const solPath = document.querySelector(".solution-path");
    if (solPath) solPath.classList.remove("draw");
    btnHide.style.display = "none";
    btnShow.style.display = "inline-block";
  }

  updateMeteoritePosition();
});
