# Calendário: importar .ics e CSV

Os eventos ficam no banco. A tela **Calendário** mostra semanas a partir do primeiro evento, a contagem regressiva das provas e os simulados registrados em cada dia.

## Importar um arquivo .ics (Google Calendar, Apple, Outlook)

No Google Calendar: **Configurações** (engrenagem), **Importar e exportar**, **Exportar**. Você recebe um `.zip` com um `.ics` por agenda. Em **Calendário**, clique em **Escolher arquivo** e selecione o `.ics`.

O que é importado:

- Título, descrição, dia, hora de início e de fim, convertidos para o **horário de Brasília**.
- Eventos de dia inteiro (um por dia, até 31 dias por evento).
- O `UID` do evento é a chave: importar o mesmo arquivo de novo atualiza, sem duplicar.

Limitações:

- **Eventos recorrentes**: só a primeira ocorrência é importada (o app avisa na prévia).
- **Sem sincronização contínua**: é uma importação sob demanda, e o app nunca altera o seu calendário original.
- Limite de 1 MB e 2.000 eventos por arquivo.

## Importar um CSV

Colunas (as obrigatórias são `data` e `titulo`):

| Coluna | Regra |
|---|---|
| `data` | `AAAA-MM-DD` ou `DD/MM/AAAA` |
| `inicio`, `fim` | `HH:MM` (opcionais) |
| `titulo` | até 120 caracteres |
| `categoria` | até 40 caracteres, por exemplo uma matéria. Define a cor e o filtro |
| `tipo` | `BLOCO` (padrão) ou `PROVA` |
| `descricao` | até 2000 caracteres |

```csv
data,inicio,fim,titulo,categoria,tipo,descricao
2026-03-02,18:00,20:00,Revisão de Matemática,Matemática,BLOCO,Lista de exercícios
2026-03-03,,,Simulado de exemplo,,PROVA,Aparece na contagem regressiva
```

Há prévia com erros por linha antes de gravar.

## Eventos do tipo prova

Eventos com `tipo = PROVA` aparecem como cartões de contagem regressiva no topo e como selo `D-N` em cada dia.

- **No CSV:** use `tipo` igual a `PROVA`.
- **No .ics:** comece o título do evento com `[prova]`, por exemplo `[prova] Fuvest 1ª fase`. O app tira o prefixo e marca o evento como prova.
