# AgroGasto - Controle de Despesas Rurais 🌾🚜

Aplicativo web progressivo e responsivo desenvolvido especialmente para produtores rurais, administradores de fazendas e gestores do agronegócio. Permite o controle financeiro detalhado de propriedades rurais de forma rápida, intuitiva e com suporte a funcionamento offline para uso direto no campo.

---

## 🚀 Principais Funcionalidades

- **Lançamento Ágil de Despesas:**
  - Pagamentos à vista, parcelados (com geração automática de parcelas e datas de vencimento mensais) ou a prazo/fiado.
  - Associação imediata a setores da fazenda e subgrupos de custo.
  - Seleção de formas de pagamento personalizadas.

- **Organização por Setores e Subgrupos:**
  - Pré-configurado para setores rurais comuns (Lavoura de Grãos, Pecuária de Corte/Leite, Maquinários & Frotas, Sede & Infraestrutura, Mão de Obra, etc.).
  - Totalmente editável nas configurações: adicione, remova ou renomeie setores e formas de pagamento.

- **Painel Financeiro & Resumos:**
  - Indicadores de total do período selecionado.
  - Painel de controle de parcelas a vencer.
  - Filtros dinâmicos por período (Hoje, Este Mês, Mês Anterior, Ano Atual ou Datas Personalizadas), setor, subgrupo e busca textual.

- **Funcionamento Offline & Nuvem (Cloud First com Offline Cache):**
  - Armazenamento em nuvem via **Firebase Firestore** com autenticação segura.
  - Cache local persistente para lançar ou consultar despesas no campo sem sinal de internet; os dados são sincronizados automaticamente ao reconectar.

- **Exportação & Backup de Dados:**
  - Exportação completa em formato **CSV** (compatível com Excel, Google Planilhas e softwares contábeis).
  - Exportação e importação/restauração em **JSON** para cópias de segurança.

- **Design Responsivo & Mobile-Friendly:**
  - Interface moderna com visual adaptado para telas de celular e computadores de escritório.
  - Navegação fluida e atalhos rápidos.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Ícones:** [Lucide React](https://lucide.dev/)
- **Animações:** [Motion](https://motion.dev/)
- **Banco de Dados & Auth:** [Firebase Firestore](https://firebase.google.com/) & Firebase Authentication

---

## 📦 Como Executar Localmente

### Pré-requisitos
- Node.js 22.12 ou superior
- npm, yarn ou pnpm

### Passos

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/Lciarallo/AgroGasto.git
   cd AgroGasto
   ```

2. **Instale as dependências:**
   ```bash
   npm ci
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   O aplicativo estará disponível em: `http://localhost:3000`

4. **Gerar build de produção:**
   ```bash
   npm run build
   ```

5. **Verificação de tipos (Linting):**
   ```bash
   npm run lint
   ```

---

## Publicar no Firebase

O AgroGasto usa um site de Hosting próprio em **https://agrogasto.web.app**, no projeto Firebase `bmtv-jornalismo-web`. A configuração em `.firebaserc` direciona o Hosting exclusivamente ao site `agrogasto`.

Depois de instalar o Firebase CLI e autenticar com `firebase login`, publique com:

```bash
firebase deploy --project bmtv-jornalismo-web --only hosting:agrogasto,firestore:rules
```

O deploy verifica os tipos e gera o build antes de enviar `dist/`. As regras configuradas em `firebase.json` se aplicam apenas ao banco nomeado do AgroGasto, `ai-studio-remixagrogastoco-7b024771-0fc0-4ccf-8435-b47c5719320f`. Os domínios `agrogasto.web.app` e `agrogasto.firebaseapp.com` precisam estar autorizados no Firebase Authentication para o login Google.

## 📤 Como Enviar para o seu GitHub

Se você já criou um repositório vazio no GitHub, execute no terminal:

```bash
# 1. Conecte o repositório remoto (substitua pela URL do seu repositório no GitHub)
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git

# 2. Defina o branch principal como main
git branch -M main

# 3. Envie o código
git push -u origin main
```

---

## 🔒 Segurança & Regras do Firestore

As regras de segurança estão definidas no arquivo `firestore.rules`. Elas garantem que cada usuário autenticado tenha acesso estritamente aos seus próprios dados de despesas e configurações da propriedade rural:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 📄 Licença

Este projeto é disponibilizado sob a licença MIT. Sinta-se livre para usar, adaptar e aprimorar para sua propriedade rural ou agronegócio.
