import { useEffect, useRef, useState } from "react";
import EasySpeech from "easy-speech";

const recognition = new window.webkitSpeechRecognition();
const synth = window.speechSynthesis;

recognition.continuous = true;
recognition.lang = "es-AR";

synth.cancel();

const rolesList = {
  "Entrevistador React": {
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
  },
  "Entrevistador Swift": {
    role: "system",
    content: `Sos una entrevistadora IT evaluando a un candidato para una posición Swift junior.
    * Siempre tenés que contestar en español Argentina.
    * Las respuestas no deben tener placeholder como "nombre de la empresa" o "mi nombre".
    * El idioma de entrevista es español argentino.
    * El idioma de respuesta es español argentino.
    * No puedes usar emojis.
    * No puedes usar markdown.
    * No puedes usar caracteres especiales fuera de los acentos latinos.
    * Deben ser preguntas técnicas acerca de Swift y su funcionamiento.
    * Si las respuestas no son correctas o específicas, indicale al candidato que no lo es y explicá por qué está mal.`,
  }
  // Puedes agregar más roles aquí si es necesario
};

function App() {
  const [initialized, setInitialized] = useState<boolean>(false);
  const [roles, setRoles] = useState<{ [key: string]: { role: "system" | "user" | "assistant"; content: string } }>(rolesList);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>();
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [buffer, setBuffer] = useState<string>("");
  const [messages, setMessages] = useState<
    {
      role: "user" | "assistant" | "system";
      content: string;
    }[]
  >([
    {
      role: "system",
      content: `Sos una entrevistadora IT evaluando a un candidato para una posición React junior.
      * Siempre tenés que contestar en español Argentina.
      * Las respuestas no deben tener placeholder como "nombre de la empresa" o "mi nombre".
      * El idioma de entrevista es español argentino.
      * El idioma de respuesta es español argentino.
      * No puedes usar emojis.
      * No puedes usar markdown.
      * No puedes usar caracteres especiales fuera de los acentos latinos.
      * Deben ser preguntas técnicas acerca de React y su funcionamiento.`,
    },
  ]);
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

    const draft = structuredClone(messages);

    draft.push({
      role: "user",
      content: buffer,
    });

    try {
      const response = await fetch("http://localhost:11434/api/chat", {
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
        throw new Error("Error al enviar el mensaje");
      }

      const { message } = await response.json();

      draft.push({
        role: "assistant",
        content: message.content,
      });

      const voice = voices.find(voice => voice.name === selectedVoice);
      EasySpeech.speak({
        text: message.content,
        voice,
      });

      setMessages(draft);
    } catch (error) {
      console.error("Error en la comunicación con el servidor:", error);
    }
  }

  function handleChangeRole(e) {
    setSelectedRole(e.target.value);
    setMessages([roles[e.target.value]]);
  }

  console.log({messages, buffer});
  return (
    <main className="container m-auto grid min-h-screen grid-rows-[auto,1fr,auto] px-4">
      <header className="text-xl font-bold leading-[4rem]">EntrevistAIdor</header>
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
      <section>
        <select
          onChange={handleChangeRole}
          value={selectedRole}
          className="mb-2 p-2 border rounded"
        >
          <option value="">Selecciona un rol</option>
          {Object.keys(roles).map(roleName => (
            <option key={roleName} value={roleName}>
              {roleName}
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
