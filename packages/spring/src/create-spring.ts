import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  untrack,
} from "solid-js";

export type CreateSpringOptions = {
  /**
   * The initial value of the spring.
   *
   * @default 0
   */
  initialValue?: number;
  /**
   * The reactive value of the spring.
   *
   * @default 0
   */
  value?: number;

  /**
   * The initial velocity of the spring.
   *
   * @default 0
   */
  initialVelocity?: number;
  /**
   * The period of the spring in seconds.
   *
   * This is the time it takes for the spring to complete one full oscillation.
   * This is not the time it takes for the spring to reach its final value.
   *
   * For example, a spring with a damping of `0` will oscillate forever, no matter
   * the period. A spring with a period of `1` and damping of `1` will animate
   * for about 1.5 seconds.
   *
   * @default 1
   */
  duration?: number;
  /**
   * The damping fraction of the spring.
   *
   * Values less than 1 will be bouncy, and values greater than 1 will be sluggish.
   *
   * Presets:
   * - 1: smooth
   * - 0.85: snappy
   * - 0.7: bouncy
   *
   * @default 1
   */
  damping?: number;
};

export type SpringApi = {
  set: (value: number, opts?: { onComplete?: () => void }) => void;
  reset: (value: number, velocity?: number) => void;
};

/**
 * Creates a reactive springy signal
 */
export function createSpring(
  opts: Accessor<CreateSpringOptions>
): [get: Accessor<number>, api: SpringApi] {
  let subscribers = new Map<number, () => void>();

  function alertSubscriber(equilibrium: number) {
    const subscriber = subscribers.get(equilibrium);
    if (subscriber) subscriber();
    subscribers.clear();
  }

  const [value, setValue] = createSignal(
    opts().initialValue ?? opts().value ?? 0
  );
  const [velocity, setVelocity] = createSignal(opts().initialVelocity ?? 0);

  const [equilibrium, setEquilibrium] = createSignal(
    opts().value ?? opts().initialValue ?? 0
  );
  const equilibriumFromOptions = createMemo(() => {
    return opts().value ?? 0;
  });
  createEffect(() => {
    setEquilibrium(equilibriumFromOptions());
  });
  const period = createMemo(() => {
    return opts().duration ?? 1;
  });
  const damping = createMemo(() => {
    return opts().damping ?? 1;
  });

  /**
   * The spring constant, k.
   */
  const springConstant = createMemo(() => {
    return getSpringConstant(period());
  });

  /**
   * The viscous damping coefficient, c.
   */
  const dampingConstant = createMemo(() => {
    return getDampingConstant(damping(), springConstant());
  });

  function step(millis: number): boolean {
    if (
      Math.abs(velocity()) < 0.001 &&
      Math.abs(value() - equilibrium()) < 0.001
    ) {
      setVelocity(0);
      setValue(equilibrium());
      alertSubscriber(equilibrium());

      return false;
    }

    const k = springConstant();
    const c = dampingConstant();
    const x0 = equilibrium();

    const stepSizeMillis = 1;
    const steps = millis / stepSizeMillis;
    let dt = stepSizeMillis / 1000;

    let x = value();
    let v = velocity();

    for (let i = 0; i < steps; i++) {
      // Force is equivalent to acceleration because I take mass to be 1kg.
      const F = -k * (x - x0) - c * v;

      const dx = v * dt;
      const dv = F * dt;

      x = x + dx;
      v = v + dv;
    }

    setValue(x);
    setVelocity(v);

    return true;
  }

  let isAnimating = false;
  function animate() {
    if (isAnimating) return;
    isAnimating = true;
    eachFrame(step, {
      onCompleted: () => {
        isAnimating = false;
      },
    });
  }

  createEffect(() => {
    equilibrium();
    untrack(() => {
      animate();
    });
  });

  const api: SpringApi = {
    set: (value, { onComplete } = {}) => {
      setEquilibrium(value);
      if (onComplete) {
        subscribers.set(value, onComplete);
      }
    },
    reset: (value, velocity) => {
      setValue(value);
      setVelocity(velocity ?? 0);
      setEquilibrium(value);
      if (velocity && !isAnimating) animate();
    },
  };

  return [value, api] as const;
}

/**
 * Calls a function on each frame, passing the time since the last frame in milliseconds.
 *
 * This will automatically stop when the function returns false.
 */
function eachFrame(fn: (ms: number) => boolean, { onCompleted = () => {} }) {
  let lastTime = 0;
  function loop(timeStamp: number) {
    const value = timeStamp - lastTime;
    let enabled = fn(value);
    lastTime = timeStamp;
    enabled ? requestAnimationFrame(loop) : onCompleted();
  }
  function firstFrame(timeStamp: number) {
    lastTime = timeStamp;
    loop(timeStamp);
  }
  requestAnimationFrame(firstFrame);
}

export function getSpringConstant(duration: number) {
  return (4 * Math.PI ** 2) / duration ** 2;
}

export function getDampingConstant(damping: number, springConstant: number) {
  if (springConstant <= 0) return 0;
  return damping * 2 * Math.sqrt(springConstant);
}
