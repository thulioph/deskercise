# Deskercise — macOS prototype

Pausas curtas de ginástica laboral para quem trabalha no computador. CLI em foreground, exercícios com referências oficiais, histórico SQLite e relatório HTML offline. Sem conta, telemetria ou backend.

## Comece aqui

Requisito: **Node.js 22.13+**; Node 24 também funciona. Este projeto tem macOS como plataforma inicial. Clone o repositório e entre na pasta do projeto:

```bash
git clone https://github.com/thulioph/deskercise.git
cd deskercise
node --version
npm ci
npm run build
npm link
```

Teste rápido, com intervalo de 3 segundos e timer de 5 segundos:

```bash
deskercise start --demo --once
deskercise report --demo
```

Quando o exercício aparecer, pressione **1** para iniciar e, ao final, **y** para confirmar. O comando `report` imprime o resumo e abre o HTML no navegador padrão. O modo demo serve para testar a interface; não é uma prescrição de exercício em 5 segundos. Seus dados ficam separados do histórico normal.

Sem instalar o comando globalmente, use `node dist/index.js` no lugar de `deskercise`:

```bash
node dist/index.js start --demo --once
node dist/index.js report --demo
```

## Uso normal

```bash
deskercise start
```

Na primeira execução, escolha um intervalo (padrão sugerido: 45 minutos). Mantenha o terminal aberto. Cada pausa oferece:

| Tecla | Ação |
|---|---|
| `1` | Iniciar o timer de 60 segundos |
| `2` | Pular este exercício |
| `3` | Adiar o mesmo exercício por 10 minutos |
| `s` | Interromper um exercício em andamento |
| `y` / `n` | Confirmar / negar conclusão após o timer |
| `q` / `Ctrl+C` | Encerrar e salvar a sessão |

O próximo intervalo começa após resolver o exercício. Um prompt sem resposta expira após 5 minutos. A confirmação final também expira após 5 minutos; isso registra `UNCONFIRMED`, sem contar minutos concluídos.

```bash
deskercise start --interval 1 --once
deskercise start --no-notifications
deskercise report
deskercise report --no-open
```

`--interval` usa minutos e substitui a preferência somente nesta execução. Se ainda não existir configuração, o valor informado vira a preferência inicial. Para mudar a preferência persistida, edite `intervalMinutes` em `~/.deskercise/config.json`.

## Exercícios e referências

O catálogo inicial contém **15 movimentos de ginástica laboral** para pescoço, ombros, mãos, punhos, braços, costas, peitoral e pernas. Cada entrada tem passos, posição, cuidado e URL da fonte. Não há rotinas de treino esportivo.

- [Newcastle Hospitals NHS — 1 minute body check](https://www.newcastle-hospitals.nhs.uk/services/newcastle-occupational-health-service/information-for-staff/physiotherapy/self-help-leaflets/1-minute-body-check/)
- [CCOHS — Stretching at the workstation](https://www.ccohs.ca/oshanswers/ergonomics/office/stretching.html)
- [Mersey Care NHS — Desk-based jobs](https://www.merseycare.nhs.uk/msk-work/desk-based-jobs)

As instruções são adaptações resumidas, com repetições ou tempos próprios. **Os 60 segundos são a janela da pausa, incluindo descanso; não sustente um alongamento por todo o timer.** Os valores 45 minutos e 60 segundos são escolhas do produto, não uma recomendação universal dessas entidades. Interrompa movimentos dolorosos. O app registra hábitos declarados e não diagnostica nem garante prevenção de lesões.

## Dados e relatório

```text
~/.deskercise/config.json
~/.deskercise/analytics.db
~/.deskercise/report.html
~/.deskercise/demo/analytics.db
~/.deskercise/demo/report.html
```

`DESKERCISE_HOME` pode apontar para outra pasta. Não há requisições de rede durante o uso ou no relatório; a instalação inicial baixa dependências do npm. Chart.js, estilos e dados são incorporados no HTML, que abre via `file://` sem servidor. Não usa CDN, fontes remotas ou analytics.

O período inclui **hoje e os seis dias anteriores no fuso local atual**. As atividades são atribuídas ao dia do primeiro prompt. Minutos contam a duração do timer somente para exercícios confirmados como concluídos. Eventos interrompidos guardam os segundos de timer, mas não entram nos minutos confirmados. Snoozes ficam no histórico de ações, preservando um único exercício no denominador da taxa de conclusão. Exercícios pendentes também entram nesse denominador.

Um exemplo gerado no teste está em `docs/demo-report.html`; abra esse arquivo no navegador para ver o relatório antes de instalar.

## Estrutura

- `src/core`: entidades, portas, timer e agregação de relatório; sem imports de Node, React, SQLite ou terminal.
- `src/infrastructure`: relógio cancelável, catálogo JSON, SQLite, configuração, notificações e geração HTML.
- `src/presentation`: interface Ink; Clack controla somente o onboarding antes de montar Ink.
- `src/index.ts`: comandos Commander e composição das dependências.
- `test`: testes de regras do timer, persistência, catálogo, configuração e relatório.
- `docs/decisions.md`: decisões, limitações e roteiro de teste no Mac.

```bash
npm test
npm run check
npm run build
npm run dev -- start --demo --once
```

## Primeiro teste no macOS

O core, SQLite e fluxo da CLI foram verificados neste ambiente Linux; **a notificação nativa e o comando macOS `open` ainda precisam do teste real no Mac**. Nenhuma compatibilidade macOS nativa foi presumida como validada.

1. Rode `deskercise start --demo --once` e confirme a chegada da notificação.
2. Volte ao terminal, pressione `1`, aguarde o timer e confirme com `y`.
3. Rode `deskercise report --demo`: confira 1 conclusão e a abertura do HTML.
4. Rode novamente; use `3` para adiar e confirme que o mesmo exercício volta após 5 segundos na demo. Use `2` para pular.
5. Encerre uma execução com `Ctrl+C` e consulte o relatório novamente.
6. Rode `deskercise start --interval 1 --once` para testar uma pausa real de 60 segundos.

Se a notificação não aparecer, confira permissões de notificação e o modo Foco do macOS. O protótipo usa `node-notifier` / `terminal-notifier`; a apresentação depende da versão do sistema. O fluxo do terminal continua funcionando quando o envio falha. Se o navegador não abrir automaticamente, abra o caminho de `report.html` exibido no terminal.

Se `better-sqlite3` precisar compilar e a instalação falhar, instale as ferramentas de linha de comando do Xcode (`xcode-select --install`) e tente `npm ci` novamente. Os binários de dependências são instalados no seu Mac; o ZIP não contém módulos nativos compilados em Linux.

Para remover o comando global: `npm unlink -g deskercise`. O histórico permanece na pasta local até você decidir removê-lo.
