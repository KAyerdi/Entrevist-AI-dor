import EasySpeech from "easy-speech";
import { useEffect, useRef, useState } from "react";

const recognition = new window.webkitSpeechRecognition();
const synth = window.speechSynthesis;

recognition.continuous = true;
recognition.lang = "es-AR";

synth.cancel();

const entrevistadorReactRole: {
  role: "system";
  content: string;
} = {
  role: "system",
  content: `Sos una entrevistadora IT evaluando a un candidato para una posición React junior.
  * Siempre tenés que contestar en español Argentina.
  * Las respuestas no deben tener placeholder como "nombre de la empresa" o "mi nombre".
  * El idioma de entrevista es español argentino.
  * El idioma de respuesta es español argentino.
  * No puedes usar emojis.
  * No puedes usar markdown.
  * No puedes usar caracteres especiales fuera de los acentos latinos.
  * Deben ser preguntas técnicas acerca de React y su funcionamiento.
  * Si las respuestas no son correctas o específicas, indicale al candidato que no lo es y explicá por qué está mal.`,
};

function App() {
  const [initialized, setInitialized] = useState<boolean>(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>();
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [buffer, setBuffer] = useState<string>("");
  const [messages, setMessages] = useState<Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>>([entrevistadorReactRole]);
  const recordController = useRef(new AbortController());

  useEffect(() => {
    const initSpeech = async () => {
      try {
        await EasySpeech.init({ maxTimeout: 5000 });
        setInitialized(true);
        const allVoices = EasySpeech.voices();
        const filteredVoices = allVoices.filter(voice => voice.lang.startsWith("es"));
        setVoices(filteredVoices);
        if (filteredVoices.length > 0) {
          setSelectedVoice(filteredVoices[0].name);
        }
      } catch (error) {
        console.error(error);
      }
    };

    initSpeech();
  }, []);

  function handleStartRecording() {
    setIsRecording(true);

    synth.cancel();
    recognition.start();

    recognition.addEventListener("result", event => {
      const buffer = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join(" ");

      setBuffer(buffer);
      console.log({buffer});
    }, { signal: recordController.current.signal });
  }

  async function handleStopRecording() {
    setIsRecording(false);
    synth.cancel();

    recognition.stop();
    recordController.current.abort();
    recordController.current = new AbortController();

    const draft: Array<{role: "user" | "assistant" | "system", content: string}> = [
      ...messages,
      { role: "user", content: buffer }
    ];

    try {
      const response = await fetch("http://localhost:5173/api/chat", {
        method: "POST",
        body: JSON.stringify({
          model: "llama2-uncensored",
          stream: false,
          messages: draft,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error del servidor: ${response.status} ${response.statusText}. Detalles: ${errorText}`);
      }

      const data = await response.json();
      if (!data.message || typeof data.message.content !== 'string') {
        throw new Error('Respuesta del servidor en formato incorrecto');
      }

      draft.push({
        role: "assistant",
        content: data.message.content,
      });

      const voice = voices.find(voice => voice.name === selectedVoice);
      if (voice) {
        await EasySpeech.speak({
          text: data.message.content,
          voice,
        });
      } else {
        console.warn('Voz seleccionada no encontrada');
      }

      setMessages(draft);
    } catch (error) {
      console.error("Error en la comunicación con el servidor:", error);
      // Aquí podrías agregar alguna lógica para mostrar el error al usuario
    }
  }

  return (
    <main className="container m-auto grid min-h-screen grid-rows-[auto,1fr,auto] px-4">
      <header className="text-xl font-bold leading-[4rem]">EntrevistAIdor React</header>
      <section>
        <select
          onChange={e => setSelectedVoice(e.target.value)}
          value={selectedVoice}
          className="mb-2 p-2 border rounded"
        >
          {voices.map(voice => (
            <option key={voice.name} value={voice.name}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </select>
      </section>
      <section className="grid place-content-center py-8">
        <button
          className={
            "h-64 w-64 rounded-full border-8 border-neutral-600 bg-red-500" +
            (isRecording ? " animate-pulse" : "")
          }
          onClick={isRecording ? handleStopRecording : handleStartRecording}
        />
      </section>
      <footer className="text-center leading-[4rem] opacity-70">
        © {new Date().getFullYear()} EntrevistAIdor
      </footer>
    </main>
  );
}

export default App;