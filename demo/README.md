# Demo: Bageriet Holm

A recording script that shows every part of the coach in about five minutes.

**The case.** Bageriet Holm is a bakery with three shops in Aarhus and 14 employees. It sells in the shops, through Wolt and as catering for offices. The owner, Mette, wants to cut slow products before the winter menu. You are the shop manager and use Claude to prepare a one-page recommendation for her.

**The data.** [`sales_2025.csv`](sales_2025.csv): 412 rows of monthly sales per shop, product and channel. It has three traps for the Review step:

- four large **catering** orders make *Hindbærsnitte* and *Glutenfri brød* look stronger than they are in the shops,
- one **refund** row with negative units (Sandwich, October),
- one row with **no cost** (Spandauer, December).

## Before you record

1. Open a new chat in this project.
2. Run `/coach preview on`, so every suggestion shows from the start.
3. Optional: `/coach model haiku` (fast and cheap; switch to `sonnet` for sharper suggestions).

## The script

| # | You type | What to point out |
|---|---|---|
| 1 | `Hi, I need help with an analysis for our bakery` | **Plan · starting new work** above the message. Under it: `◐ Could add: question, which data, audience`. After the reply, a template with `[slots]` in the prompt box (Tab takes it). |
| 2 | `Analyse sales_2025.csv and tell me which 3 products we should drop from the winter menu. It's for Mette, the owner, by Friday, as a one-page summary.` | **Brief** with a `✓` such as *Audience is named* or *Says what done looks like*: a good brief gets recognised. |
| 3 | *(Claude answers)* | The step line turns to **Review**: your turn to check. Suggestions appear above the prompt, for example *What did you assume?*, and under the reply `Worth checking: …` with the claims to verify. |
| 4 | Click a suggestion, or type `Did you include the catering orders in those numbers?` | **Review · checking Claude's result** with `✓ Questioned the result`. This is where the catering trap usually surfaces. |
| 5 | `Use only shop and Wolt sales, not catering, and use margin instead of revenue.` | **Review** with `✓ Corrected Claude`. |
| 6 | `Looks good, this is the final version for Mette.` | **Own · taking it as final**. The Own checks appear: *Tested myself*, *No client data*, and a third from the conversation. Tick them, or *Continue anyway*. |

## Extra moments, if there is time

- **Focus:** press `Coach` → *Focus on* → **Review** to get review suggestions on demand.
- **Dismiss and bring back:** `✕` on the suggestions, then `Coach` → *Show suggestions*.
- **Cost:** the `Coach` menu shows the coach as a share of the session, for example `Coach 2% of this session`.
- **Model:** `/coach model sonnet`, then `/coach model` to show which one runs.
- **Under the hood:** `/coach why` shows what the analysis did on the last turn.
- **Danish:** steps work in Danish too, for example `Jeg har brug for hjælp til en analyse` (Plan) and `Det ser godt ud` (Own).

## Talking points

- The coach never blocks or rewrites your prompt; it only adds a line above, a note below and optional suggestions.
- It names what a message *did* (Plan, Brief, Review, Own), so the habit of checking Claude's work becomes visible.
- The catering trap shows why Review matters: the first answer can look right and still rest on an assumption.
