import { createSpring } from "@hypergood/spring";
import { Title } from "@solidjs/meta";

export default function Home() {
  const [spring, api] = createSpring(() => ({ value: 0, damping: 0.7, duration: 0.5}));
  return (
    <main>
      <Title>Hello World</Title>
      <h1>Hello world!</h1>
      <button onClick={() => {
        if (spring() > 0.5) {
          api.set(0);
        } else {
          api.set(1, {onComplete: () => console.log("woohoo")});
        }
      }}>Toggle</button>
      <button onClick={() => {
          api.reset(0, 20);
          api.set(1);
      }}>Bonk</button>
      <input type="range" min={-1} max={2} step={0.001} value={spring()} css={{width:"100%"}} />
    </main>
  );
}
