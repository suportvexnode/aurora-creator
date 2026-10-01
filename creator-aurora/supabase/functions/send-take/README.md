# Função `send-take`

Esta função mantém o webhook do Discord fora do navegador, valida o usuário autenticado e limita as menções aos cargos previamente configurados.

## Configuração

Cadastre os secrets no projeto Supabase:

- `DISCORD_TAKE_DESTINATIONS`: JSON com os canais disponíveis e suas URLs de webhook. Exemplo no `.env.example`.
- `DISCORD_TAKE_WEBHOOK_URL`: configuração antiga para um único canal; continua funcionando quando `DISCORD_TAKE_DESTINATIONS` não estiver definido.
- `DISCORD_TAKE_ROLES`: JSON com os cargos disponíveis no painel. Exemplo no `.env.example`.
- `TAKE_ALLOWED_ORIGINS`: opcional; domínios adicionais separados por vírgula.

Exemplo com vários canais, em uma única linha:

```json
[{"id":"takes","name":"takes","webhookUrl":"https://discord.com/api/webhooks/ID_1/TOKEN_1"},{"id":"eventos","name":"eventos","webhookUrl":"https://discord.com/api/webhooks/ID_2/TOKEN_2"}]
```

Depois, publique novamente a função `send-take`. O painel usa a sessão atual do Supabase para consultar cargos e canais (`GET`) e enviar a solicitação para o destino escolhido (`POST`). As URLs nunca são retornadas ao navegador.

O gateway da função pode permanecer com verificação de JWT habilitada. A própria função também valida o token antes de acessar a configuração ou enviar ao Discord.
