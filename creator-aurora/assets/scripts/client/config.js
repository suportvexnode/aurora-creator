


const SUPABASE_URL = 'https://buujbhfmpujtlnbncget.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dWpiaGZtcHVqdGxuYm5jZ2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzUyNzQsImV4cCI6MjA5MjMxMTI3NH0.JnKVtBG9FT4FVDGN2CmluNWl-RaRtQ1Yw5LwPCG_4GY';

window.YOUTUBE_API_KEY = 'AIzaSyAB_LfyCNRqqSW-vEApLihMxoJb7RHyBRo';
window.GROQ_API_KEY    = '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';


const R2_BASE_URL = 'https://pub-4beee96637f74bd29c522a728d2b25b6.r2.dev';


const R2_LIST_ENDPOINT = `${SUPABASE_URL}/functions/v1/r2-list`;


const DEMO_MODE = false; 


const STEPS = [
    { id: 1, name: "Vida Comum", guide: "Apresente o protagonista no seu mundo cotidiano. Quem é ele? Qual é sua rotina, seus desejos, suas falhas?" },
    { id: 2, name: "Algo Acontece", guide: "Um evento perturbador rompe com a normalidade. Qual é o gatilho que inicia a jornada? Pode ser interno ou externo." },
    { id: 3, name: "Resistência", guide: "O herói hesita ou recusa o chamado. Que medos, crenças ou circunstâncias o impedem de agir?" },
    { id: 4, name: "Ajuda Aparece", guide: "Um mentor, aliado ou recurso surge. Quem ou o quê dá ao herói o empurrão, a ferramenta ou a sabedoria necessária?" },
    { id: 5, name: "Primeiro Desafio", guide: "O herói cruza o limiar — compromete-se com a jornada. Qual é o primeiro obstáculo real que ele enfrenta?" },
    { id: 6, name: "Testes", guide: "Uma série de provas e encontros molda o herói. Que alianças se formam? Que inimigos surgem? O que ele aprende?" },
    { id: 7, name: "Maior Desafio", guide: "A preparação final antes do confronto máximo. O herói enfrenta seu maior medo, reflexo de si mesmo ou o antagonista de frente." },
    { id: 8, name: "Crise", guide: "O ponto mais sombrio da história. Tudo parece perdido. O que o herói perde — ou deve abandonar — para seguir em frente?" },
    { id: 9, name: "Luz no Fim do Túnel", guide: "Uma centelha de esperança ou revelação. O herói encontra dentro de si o que precisa para seguir. Qual é o insight?" },
    { id: 10, name: "Ressurreição", guide: "O clímax. O herói aplica o que aprendeu e supera o desafio definitivo. Como ele vence — ou muda — de forma irreversível?" },
    { id: 11, name: "Prova de Sucesso", guide: "O resultado concreto da vitória. O que mudou no mundo externo da história? Como o sucesso se manifesta visivelmente?" },
    { id: 12, name: "Transformação", guide: "O herói retorna transformado. Como ele é diferente? O que carrega de volta? Qual é a lição que ressoa para o espectador?" },
];