# Fotografia Odontológica no Celular

Ferramentas gratuitas para treinar o protocolo fotográfico odontológico usando o celular.
Material de apoio da aula do Dr. Tiago Botelho (EOA), com a identidade da EXACT Odontologia Digital. Uso educacional.

**Tudo roda no navegador do aluno. Nenhuma foto é enviada para servidor algum.**

## O que tem

| Aba | Para que serve |
|---|---|
| **Gabarito** | Escolha o tipo de foto (frontal em repouso e sorrindo, lábios em repouso, perfil em repouso e sorrindo, intraoral frontal, laterais esquerda e direita). As fotos ficam numa série e, no final, o botão **Gerar PDF** monta a folha com as 8 fotos, abra a câmera e alinhe com as linhas-guia. Também funciona sobre uma foto da galeria. |
| **Avaliador** | Mede nitidez (foco), áreas estouradas/reflexos, exposição e resolução, e dá dicas do que corrigir. |
| **Editor** | Botão **Melhorar automaticamente** (corrige brilho e contraste e aplica nitidez leve, sem mexer na cor), **balanço de branco por toque no cinza**, e 4 controles simples: brilho, contraste, cor e nitidez. Em *Mais ajustes*: realces, sombras, matiz, saturação, endireitar e corte. Exporta JPEG sem dados de localização (EXIF). |

## Como publicar no GitHub (sem instalar nada)

1. No GitHub, clique em **New repository**. Nome sugerido: `foto-odonto`. Deixe **Public**.
2. Clique em **uploading an existing file** e arraste **todo o conteúdo desta pasta** (inclusive as pastas `js` e `icons` e o arquivo `.nojekyll`). Clique em **Commit changes**.
3. Vá em **Settings → Pages**. Em *Build and deployment*, escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**, e salve.
4. Em 1 a 2 minutos o site fica em `https://SEU-USUARIO.github.io/foto-odonto/`.
5. Gere um **QR code** desse endereço e coloque no último slide da aula.

Dica: depois do primeiro acesso, o site abre mesmo sem internet (funciona como aplicativo; no celular, use *Adicionar à tela inicial*).

## Atualizar o site

Edite os arquivos no GitHub e, se mudar qualquer arquivo, aumente o número `VERSAO` no começo de `sw.js` (por exemplo `fotoodonto-v2`). Assim o celular dos alunos baixa a versão nova.

## Padrão de zoom

A câmera do Gabarito abre sempre em **2,5x**. Fotos de face: celular na vertical, a cerca de 1 m. Fotos de lábios e intraorais: celular na horizontal, a 30 a 50 cm. O selo no canto do quadro mostra como o zoom foi aplicado: "(câmera)" quando o navegador controla o zoom real (Chrome no Android, em geral) e "(recorte digital)" quando não controla (iPhone/Safari), caso em que a foto é recortada no centro e perde resolução.

## Limites (para dizer na aula)

- A câmera do navegador tem qualidade menor que o app de câmera do celular e não controla ISO nem velocidade. Para a melhor qualidade: fotografar no app nativo (modo Pro/manual, se houver) e carregar a foto no Avaliador e no Editor.
- O avaliador mede a **imagem** (foco, luz, brilho, resolução). Ele não julga enquadramento, afastadores, saliva nem a correção clínica. Os limiares são empíricos e servem como apoio ao treino.
- O balanço de branco precisa de uma referência neutra na foto (cartão cinza 18% ou superfície branca/cinza neutra).
- As linhas-guia são referências gerais de enquadramento, não medidas anatômicas.
- Em documentação clínica, edite o mínimo. Não use nome de paciente no nome do arquivo.

## Estrutura

```
index.html  style.css  sw.js  manifest.webmanifest  .nojekyll
js/    app.js  state.js  guides.js  gabarito.js  avaliador.js  editor.js
icons/ icon-192.png  icon-512.png
```

Sem dependências externas, sem build. Para testar no computador: `python3 -m http.server` na pasta e abrir `http://localhost:8000`.

## Licença

Defina a licença ao publicar (por exemplo MIT, se quiser permitir reuso livre, ou deixe sem licença para manter todos os direitos reservados).
