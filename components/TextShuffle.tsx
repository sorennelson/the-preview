import { useState, useEffect, useRef } from 'react';

export default function TextShuffle() {
  const words = ['show', 'trip', 'party', 'workout', 'date', 'adventure'];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  // Type the ref as HTMLSpanElement | null
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [width, setWidth] = useState(0);

  // Update width to smoothly recenter
  useEffect(() => {
    if (textRef.current) {
      setWidth(textRef.current.offsetWidth);
    }
  }, [currentIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);

      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % words.length);
        setFade(true);
      }, 500);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <p className="flex justify-center">
      Playlist creation for your next
      <span
        className="inline-block transition-all duration-500 ml-1"
        style={{ width }}
      >
        <span
          ref={textRef}
          className={`inline-block transition-opacity duration-500 ${
            fade ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {words[currentIndex]}
        </span>
      </span>
    </p>
  );
}
