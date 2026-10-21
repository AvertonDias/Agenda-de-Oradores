# Documentação - Agenda de Oradores

Este aplicativo foi desenvolvido para simplificar a gestão de discursos públicos e o intercâmbio de oradores entre congregações das Testemunhas de Jeová.

## 🚀 Funcionalidades Principais

### 1. Calendário Geral (Painel Inicial)
*   **Visão Unificada**: Exibe todos os discursos (recebendo, saindo e locais) e eventos da congregação em uma lista cronológica.
*   **Filtros Inteligentes**: Filtre por tipo de compromisso ou pesquise por tema, orador ou congregação.
*   **Gestão de Passados**: Opção para visualizar ou ocultar compromissos que já ocorreram.
*   **Ações Rápidas**: Botões de edição, exclusão e notificação via WhatsApp sempre visíveis.

### 2. Agendamento Inteligente
*   **Fluxos Distintos**: Abas separadas para "Receber Visita" (orador de fora vindo à sua congregação) e "Orador Saindo" (orador local indo para outra congregação).
*   **Trava de Conflitos**: O sistema impede o agendamento em datas com eventos cadastrados ou se já houver outro discurso no mesmo horário localmente.
*   **Seletor de Temas**: Lista completa de esboços atualizados com busca rápida.
*   **Temas Especiais**: Aba dedicada para digitar temas manuais (ex: Discursos Especiais ou de Comemoração).

### 3. Histórico de Temas
*   **Rastreamento Local**: Veja exatamente qual foi a última data em que um tema específico foi proferido na sua congregação.
*   **Frequência de Uso**: Contador de quantas vezes cada tema foi utilizado, ajudando a garantir variedade no alimento espiritual.
*   **Filtros de Recorrência**: Identifique temas "nunca usados", "usados recentemente" ou "parados há mais de um ano".

### 4. Gestão de Eventos
*   **Bloqueio de Datas**: Cadastre Assembleias, Congressos, Visitas do Superintendente e Celebrações.
*   **Preenchimento Automático**: Ao selecionar "Visita do Superintendente", o sistema sugere automaticamente o período de terça a domingo.
*   **Conflitos**: Avisa se você tentar cadastrar um evento em uma data que já possui discursos agendados.

### 5. Oradores e Repertório
*   **Cadastro Individual**: Gerencie nome, telefone e congregação de origem.
*   **Gestão de Temas**: Selecione quais esboços cada orador está preparado para proferir.
*   **Busca Global**: Localize oradores pelo nome ou pelos temas que eles possuem.

### 6. Congregações e Importação JW.org
*   **Workspace**: Gerencie sua própria congregação e mantenha uma lista de congregações "vizinhas".
*   **Importação Mágica**: Campo de texto que processa dados copiados do site JW.org, extraindo automaticamente nome, endereço, dia de reunião e coordenadas.
*   **Localização**: Integração com Google Maps para envio de localização aos oradores.

### 7. Sistema de Ajudantes (Colaboração)
*   **Gestão Administrativa**: O criador da congregação pode convidar outros irmãos para ajudar na gestão.
*   **Convites de Uso Único**: Gera links seguros que expiram após serem aceitos, garantindo que apenas pessoas autorizadas acessem os dados.

### 8. Comunicação via WhatsApp
*   **Notificações Formatadas**: Gere mensagens profissionais para confirmar discursos com os oradores, incluindo data, hora, tema e link de localização.
*   **Relatórios Mensais**: Gere o "Arranjo Mensal" formatado para enviar aos coordenadores de congregações vizinhas ou para o grupo da congregação local.

## 📱 Tecnologia
*   **PWA (Progressive Web App)**: O sistema pode ser instalado no celular como um aplicativo nativo, funcionando em tela cheia e com acesso rápido.
*   **Offline First**: Interface rápida e responsiva otimizada para dispositivos móveis.
*   **Segurança**: Dados protegidos via Firebase Auth e Firestore Security Rules.