// =====================================================
// Odinote — Sample Templates & Translations Data
// Showcasing Architecture, Game Design, and Marketing
// =====================================================

const SAMPLE_PROJECTS = [];

// All canvases live in one big map. Root canvas key = project id.
// Boards are first-class items with their own canvas key.
const INITIAL_CANVASES = {};

const TRANSLATIONS = {
  es: {
    home_hero: 'Tu mente,\nordenada en\ncanvases.',
    home_sub: 'Oddinote es un canvas infinito con tableros anidados. Pensado para game devs, escritores y creativos que no caben en una sola pantalla.',
    new_project: 'Nuevo proyecto',
    search_projects: 'Buscar proyectos…',
    recent: 'Recientes',
    all_projects: 'Todos los proyectos',
    items_count: 'nodos',
    open_board: 'Abrir',
    home: 'Inicio',
    tool_note: 'Nota', tool_link: 'Enlace', tool_todo: 'To-do', tool_line: 'Línea', tool_draw: 'Dibujar',
    tool_board: 'Tablero', tool_column: 'Columna', tool_comment: 'Comentar',
    tool_image: 'Imagen', tool_doc: 'Documento', tool_calendar: 'Calendario',
    tool_table: 'Tabla', tool_audio: 'Audio',
    tool_color: 'Color', tool_file: 'Archivo',
    tool_frame: 'Marco', tool_bigtitle: 'Título', tool_map: 'Mapa', tool_shape: 'Figura', tool_code: 'Código',
    search_canvas: 'Buscar en este canvas…',
    new_canvas: 'Nuevo canvas',
  },
  en: {
    home_hero: 'Your mind,\norganized as\ncanvases.',
    home_sub: 'Oddinote is an infinite canvas with nested boards. Built for game devs, writers and creatives who don\'t fit on one screen.',
    new_project: 'New project',
    search_projects: 'Search projects…',
    recent: 'Recent',
    all_projects: 'All projects',
    items_count: 'nodes',
    open_board: 'Open',
    home: 'Home',
    tool_note: 'Note', tool_link: 'Link', tool_todo: 'To-do', tool_line: 'Line', tool_draw: 'Draw',
    tool_board: 'Board', tool_column: 'Column', tool_comment: 'Comment',
    tool_image: 'Image', tool_doc: 'Document', tool_calendar: 'Calendar',
    tool_table: 'Table', tool_audio: 'Audio',
    tool_color: 'Color', tool_file: 'File',
    tool_frame: 'Frame', tool_bigtitle: 'Title', tool_map: 'Map', tool_shape: 'Shape', tool_code: 'Code',
    search_canvas: 'Search this canvas…',
    new_canvas: 'New canvas',
  },
  fr: {
    home_hero: 'Votre esprit,\nordonné en\ncanevas.',
    home_sub: 'Oddinote est un canevas infini avec des tableaux imbriqués. Conçu pour les développeurs de jeux, écrivains et créatifs.',
    new_project: 'Nouveau projet',
    search_projects: 'Rechercher des projets…',
    recent: 'Récents',
    all_projects: 'Tous les projets',
    items_count: 'nœuds',
    open_board: 'Ouvrir',
    home: 'Accueil',
    tool_note: 'Note', tool_link: 'Lien', tool_todo: 'À faire', tool_line: 'Ligne', tool_draw: 'Dessiner',
    tool_board: 'Tableau', tool_column: 'Colonne', tool_comment: 'Commentaire',
    tool_image: 'Image', tool_doc: 'Document', tool_calendar: 'Calendrier',
    tool_table: 'Tableau', tool_audio: 'Audio',
    tool_color: 'Couleur', tool_file: 'Fichier',
    search_canvas: 'Rechercher dans ce canevas…',
    new_canvas: 'Nouveau canevas',
  },
  de: {
    home_hero: 'Ihr Geist,\ngeordnet in\nLeinwänden.',
    home_sub: 'Oddinote ist eine unendliche Leinwand mit verschachtelten Boards. Entwickelt für Game-Devs, Autoren und Kreative.',
    new_project: 'Neues Projekt',
    search_projects: 'Projekte suchen…',
    recent: 'Verlauf',
    all_projects: 'Alle Projekte',
    items_count: 'Knoten',
    open_board: 'Öffnen',
    home: 'Startseite',
    tool_note: 'Notiz', tool_link: 'Link', tool_todo: 'To-Do', tool_line: 'Linie', tool_draw: 'Zeichnen',
    tool_board: 'Board', tool_column: 'Spalte', tool_comment: 'Kommentar',
    tool_image: 'Bild', tool_doc: 'Dokument', tool_calendar: 'Kalender',
    tool_table: 'Tabelle', tool_audio: 'Audio',
    tool_color: 'Farbe', tool_file: 'Datei',
    search_canvas: 'Auf dieser Leinwand suchen…',
    new_canvas: 'Neue Leinwand',
  },
  it: {
    home_hero: 'La tua mente,\nordinata in\ntavole.',
    home_sub: 'Oddinote è una tela infinita con tavole annidate. Pensata per game dev, scrittori e creativi che non entrano in un solo schermo.',
    new_project: 'Nuovo progetto',
    search_projects: 'Cerca progetti…',
    recent: 'Recenti',
    all_projects: 'Tutti i progetti',
    items_count: 'nodi',
    open_board: 'Apri',
    home: 'Inizio',
    tool_note: 'Nota', tool_link: 'Link', tool_todo: 'To-Do', tool_line: 'Linea', tool_draw: 'Disegna',
    tool_board: 'Tavola', tool_column: 'Colonna', tool_comment: 'Commento',
    tool_image: 'Immagine', tool_doc: 'Documento', tool_calendar: 'Calendario',
    tool_table: 'Tabella', tool_audio: 'Audio',
    tool_color: 'Colore', tool_file: 'File',
    search_canvas: 'Cerca in questa tela…',
    new_canvas: 'Nuova tela',
  },
  pt: {
    home_hero: 'Sua mente,\norganizada em\ntelas.',
    home_sub: 'Oddinote é uma tela infinita com quadros aninhados. Projetado para game devs, escritores e criativos que não cabem em uma só tela.',
    new_project: 'Novo projeto',
    search_projects: 'Buscar projetos…',
    recent: 'Recentes',
    all_projects: 'Todos os projetos',
    items_count: 'nós',
    open_board: 'Abrir',
    home: 'Início',
    tool_note: 'Nota', tool_link: 'Link', tool_todo: 'Lista de tarefas', tool_line: 'Linha', tool_draw: 'Desenhar',
    tool_board: 'Quadro', tool_column: 'Coluna', tool_comment: 'Comentário',
    tool_image: 'Imagem', tool_doc: 'Documento', tool_calendar: 'Calendário',
    tool_table: 'Tabela', tool_audio: 'Áudio',
    tool_color: 'Cor', tool_file: 'Arquivo',
    search_canvas: 'Buscar nesta tela…',
    new_canvas: 'Nova tela',
  },
  zh: {
    home_hero: '理清思绪，\n尽在无限\n画布。',
    home_sub: 'Oddinote 是一个具有嵌套看板的无限画布。专为游戏开发者、作家和创意人员设计。',
    new_project: '新建项目',
    search_projects: '搜索项目…',
    recent: '最近',
    all_projects: '所有项目',
    items_count: '节点',
    open_board: '打开',
    home: '首页',
    tool_note: '便签', tool_link: '链接', tool_todo: '待办事项', tool_line: '连线', tool_draw: '绘图',
    tool_board: '看板', tool_column: '列栏', tool_comment: '评论',
    tool_image: '图片', tool_doc: '文档', tool_calendar: '日历',
    tool_table: '表格', tool_audio: '音频',
    tool_color: '颜色', tool_file: '文件',
    search_canvas: '在此画布中搜索…',
    new_canvas: '新画布',
  },
  ja: {
    home_hero: '無限のキャンバスで\n思考を整理する。',
    home_sub: 'Oddinoteは、ネストされたボードを備えた無限のキャンバスです。ゲーム開発者、作家、クリエイター向けに設計されています。',
    new_project: '新規プロジェクト',
    search_projects: 'プロジェクトを検索…',
    recent: '最近',
    all_projects: 'すべてのプロジェクト',
    items_count: 'ノード',
    open_board: '開く',
    home: 'ホーム',
    tool_note: 'メモ', tool_link: 'リンク', tool_todo: 'ToDo', tool_line: 'ライン', tool_draw: '描く',
    tool_board: 'ボード', tool_column: 'カラム', tool_comment: 'コメント',
    tool_image: '画像', tool_doc: 'ドキュメント', tool_calendar: 'カレンダー',
    tool_table: 'テーブル', tool_audio: 'オーディオ',
    tool_color: 'カラー', tool_file: 'ファイル',
    search_canvas: 'このキャンバス内を検索…',
    new_canvas: '新規キャンバス',
  },
  ko: {
    home_hero: '무한한 캔버스에\n당신의 생각을\n정리하세요.',
    home_sub: 'Oddinote는 중첩된 보드가 있는 무한 캔버스입니다. 게임 개발자, 작가, 크리에이터를 위해 설계되었습니다.',
    new_project: '새 프로젝트',
    search_projects: '프로젝트 검색…',
    recent: '최근 항목',
    all_projects: '모든 프로젝트',
    items_count: '노드',
    open_board: '열기',
    home: '홈',
    tool_note: '노트', tool_link: '링크', tool_todo: '할 일 목록', tool_line: '선', tool_draw: '그리기',
    tool_board: '보드', tool_column: '열', tool_comment: '댓글',
    tool_image: '이미지', tool_doc: '문서', tool_calendar: '캘린더',
    tool_table: '표', tool_audio: '오디오',
    tool_color: '색상', tool_file: '파일',
    search_canvas: '캔버스에서 검색…',
    new_canvas: '새 캔버스',
  },
  ar: {
    home_hero: 'رتب أفكارك\nفي لوحات\nمترابطة.',
    home_sub: 'أودينوت هي مساحة لا نهائية تحتوي على لوحات متداخلة. صُممت لمطوري الألعاب والكتاب والمبدعين.',
    new_project: 'مشروع جديد',
    search_projects: 'البحث عن مشاريع…',
    recent: 'المشاريع الأخيرة',
    all_projects: 'جميع المشاريع',
    items_count: 'عناصر',
    open_board: 'فتح',
    home: 'الرئيسية',
    tool_note: 'ملاحظة', tool_link: 'رابط', tool_todo: 'مهام', tool_line: 'خط', tool_draw: 'رسم',
    tool_board: 'لوحة', tool_column: 'عمود', tool_comment: 'تعليق',
    tool_image: 'صورة', tool_doc: 'مستند', tool_calendar: 'تقويم',
    tool_table: 'جدول', tool_audio: 'صوت',
    tool_color: 'لون', tool_file: 'ملف',
    search_canvas: 'البحث في هذه اللوحة…',
    new_canvas: 'لوحة جديدة',
  },
  ru: {
    home_hero: 'Ваш разум,\nорганизованный в\nхолсты.',
    home_sub: 'Oddinote — это бесконечный холст с вложенными досками. Создан для разработчиков игр, писателей и творцов, которым мало одного экрана.',
    new_project: 'Новый проект',
    search_projects: 'Поиск проектов…',
    recent: 'Недавние',
    all_projects: 'Все проекты',
    items_count: 'узлов',
    open_board: 'Открыть',
    home: 'Главная',
    tool_note: 'Заметка', tool_link: 'Ссылка', tool_todo: 'Список задач', tool_line: 'Линия', tool_draw: 'Рисовать',
    tool_board: 'Доска', tool_column: 'Колонка', tool_comment: 'Комментарий',
    tool_image: 'Изображение', tool_doc: 'Документ', tool_calendar: 'Календарь',
    tool_table: 'Таблица', tool_audio: 'Аудио',
    tool_color: 'Цвет', tool_file: 'Файл',
    search_canvas: 'Поиск на холсте…',
    new_canvas: 'Новый холст',
  },
};

Object.assign(window, { SAMPLE_PROJECTS, INITIAL_CANVASES });

// Wrap each language translation object in a Proxy to fallback to English/Spanish keys
const createLangProxy = (langObj, langKey) => {
  return new Proxy(langObj, {
    get(target, prop) {
      if (typeof prop === 'symbol' || (typeof prop === 'string' && (prop.startsWith('$$') || ['prototype', 'constructor', 'toJSON', 'toString', 'valueOf', 'then'].includes(prop)))) {
        return target[prop];
      }
      if (prop in target) return target[prop];
      // Fallback to english translation key, then spanish translation key
      const fallbackLang = langKey === 'en' ? 'es' : 'en';
      const fallbackObj = TRANSLATIONS[fallbackLang];
      if (fallbackObj && prop in fallbackObj) {
        return fallbackObj[prop];
      }
      return "";
    }
  });
};

const TRANSLATIONS_PROXY = new Proxy(
  Object.keys(TRANSLATIONS).reduce((acc, key) => {
    acc[key] = createLangProxy(TRANSLATIONS[key], key);
    return acc;
  }, {}),
  {
    get(target, prop) {
      if (typeof prop === 'symbol' || (typeof prop === 'string' && (prop.startsWith('$$') || ['prototype', 'constructor', 'then'].includes(prop)))) {
        return target[prop];
      }
      if (prop in target) {
        return target[prop];
      }
      // If language itself is not found, fallback to 'en', then 'es'
      return target['en'] || target['es'] || {};
    }
  }
);

window.TRANSLATIONS = TRANSLATIONS_PROXY;

// ==========================================================================
// CENTRALIZED UI WORDS TRANSLATIONS FOR 10 OFFLINE LANGUAGES
// ==========================================================================
window.UI_WORDS = {
  "Tablero vacío": {
    "es": "Tablero vacío",
    "en": "Empty board",
    "fr": "Tableau vide",
    "de": "Leeres Board",
    "it": "Tavola vuota",
    "pt": "Quadro vazio",
    "zh": "空看板",
    "ja": "空のボード",
    "ko": "빈 보드",
    "ar": "لوحة فارغة",
    "ru": "Пустая доска"
  },
  "La papelera está vacía": {
    "es": "La papelera está vacía",
    "en": "Trash is empty",
    "fr": "La corbeille est vide",
    "de": "Der Papierkorb ist leer",
    "it": "Il cestino è vuoto",
    "pt": "A lixeira está vazia",
    "zh": "回收站已空",
    "ja": "ゴミ箱は空です",
    "ko": "휴지통이 비어 있습니다",
    "ar": "سلة المهملات فارغة",
    "ru": "Корзина пуста"
  },
  "Ninguno": {
    "es": "Ninguno",
    "en": "None",
    "fr": "Aucun",
    "de": "Keine",
    "it": "Nessuno",
    "pt": "Nenhum",
    "zh": "无",
    "ja": "なし",
    "ko": "없음",
    "ar": "لا أحد",
    "ru": "Никто"
  },
  "Día": {
    "es": "Día",
    "en": "Day",
    "fr": "Jour",
    "de": "Tag",
    "it": "Giorno",
    "pt": "Dia",
    "zh": "日",
    "ja": "日",
    "ko": "일",
    "ar": "يوم",
    "ru": "День"
  },
  "Mes anterior": {
    "es": "Mes anterior",
    "en": "Previous month",
    "fr": "Mois précédent",
    "de": "Vorheriger Monat",
    "it": "Mese precedente",
    "pt": "Mês anterior",
    "zh": "上个月",
    "ja": "前月",
    "ko": "이전 달",
    "ar": "الشهر السابق",
    "ru": "Предыдущий месяц"
  },
  "Mes siguiente": {
    "es": "Mes siguiente",
    "en": "Next month",
    "fr": "Mois suivant",
    "de": "Nächster Monat",
    "it": "Mese successivo",
    "pt": "Próximo mês",
    "zh": "下个月",
    "ja": "翌月",
    "ko": "다음 달",
    "ar": "الشهر التالي",
    "ru": "Следующий месяц"
  },
  "Añadir imagen": {
    "es": "Añadir imagen",
    "en": "Add image",
    "fr": "Ajouter une image",
    "de": "Bild hinzufügen",
    "it": "Aggiungi immagine",
    "pt": "Adicionar imagem",
    "zh": "添加图片",
    "ja": "画像を追加",
    "ko": "이미지 추가",
    "ar": "إضافة صورة",
    "ru": "Добавить изображение"
  },
  "Borrar imagen": {
    "es": "Borrar imagen",
    "en": "Remove image",
    "fr": "Supprimer l'image",
    "de": "Bild entfernen",
    "it": "Rimuovi immagine",
    "pt": "Remover imagem",
    "zh": "移除图片",
    "ja": "画像を削除",
    "ko": "이미지 제거",
    "ar": "إزالة الصورة",
    "ru": "Удалить изображение"
  },
  "Clic para editar · Clic derecho para borrar": {
    "es": "Clic para editar · Clic derecho para borrar",
    "en": "Click to edit · Right-click to delete",
    "fr": "Cliquer pour modifier · Clic droit pour supprimer",
    "de": "Klicken zum Bearbeiten · Rechtsklick zum Löschen",
    "it": "Clicca per modificare · Tasto destro per eliminare",
    "pt": "Clique para editar · Clique com o botão direito para excluir",
    "zh": "点击编辑 · 右键删除",
    "ja": "クリックで編集 · 右クリックで削除",
    "ko": "클릭하여 편집 · 마우스 오른쪽 버튼을 클릭하여 삭제",
    "ar": "انقر للتعديل · انقر بزر الماوس الأيمن للحذف",
    "ru": "Нажмите, чтобы отредактировать · Щелкните правой кнопкой мыши, чтобы удалить"
  },
  "+ evento": {
    "es": "+ evento",
    "en": "+ event",
    "fr": "+ événement",
    "de": "+ Ereignis",
    "it": "+ evento",
    "pt": "+ evento",
    "zh": "+ 事件",
    "ja": "+ イベント",
    "ko": "+ 이벤트",
    "ar": "+ حدث",
    "ru": "+ событие"
  },
  "Clic en un día para evento · ícono de imagen para foto": {
    "es": "Clic en un día para evento · ícono de imagen para foto",
    "en": "Click a day for event · image icon for photo",
    "fr": "Cliquez sur un jour pour un événement · icône d'image pour photo",
    "de": "Klicken Sie auf einen Tag für ein Ereignis · Bildsymbol für Foto",
    "it": "Clicca su un giorno per un evento · icona immagine per foto",
    "pt": "Clique em um dia para evento · ícone de imagem para foto",
    "zh": "点击日期添加事件 · 点击图片图标添加照片",
    "ja": "クリックでイベント追加 · 画像アイコンで写真追加",
    "ko": "이벤트를 추가하려면 날짜를 클릭하세요 · 사진을 추가하려면 이미지 아이콘을 클릭하세요",
    "ar": "انقر فوق يوم للحدث · أيقونة صورة للصورة",
    "ru": "Нажмите на day для события · значок изображения для фото"
  },
  "Evento": {
    "es": "Evento",
    "en": "Event",
    "fr": "Événement",
    "de": "Ereignis",
    "it": "Evento",
    "pt": "Evento",
    "zh": "事件",
    "ja": "イベント",
    "ko": "이벤트",
    "ar": "حدث",
    "ru": "Событие"
  },
  "Imagen": {
    "es": "Imagen",
    "en": "Image",
    "fr": "Image",
    "de": "Bild",
    "it": "Immagine",
    "pt": "Imagem",
    "zh": "图片",
    "ja": "画像",
    "ko": "이미지",
    "ar": "صورة",
    "ru": "Изображение"
  },
  "Limpiar": {
    "es": "Limpiar",
    "en": "Clear",
    "fr": "Effacer",
    "de": "Löschen",
    "it": "Pulisci",
    "pt": "Limpar",
    "zh": "清除",
    "ja": "クリア",
    "ko": "지우기",
    "ar": "مسح",
    "ru": "Очистить"
  },
  "Escribe tu nota…": {
    "es": "Escribe tu nota…",
    "en": "Write your note…",
    "fr": "Écrivez votre note...",
    "de": "Schreiben Sie Ihre Notiz...",
    "it": "Scrivi la tua nota...",
    "pt": "Escreva sua nota...",
    "zh": "写下便签...",
    "ja": "メモを書く...",
    "ko": "노트 쓰기...",
    "ar": "اكتب ملاحظتك...",
    "ru": "Напишите свою заметку..."
  },
  "Añade una leyenda…": {
    "es": "Añade una leyenda…",
    "en": "Add a caption…",
    "fr": "Ajouter une légende...",
    "de": "Fügen Sie eine Beschriftung hinzu...",
    "it": "Aggiungi una didascalia...",
    "pt": "Adicione uma legenda...",
    "zh": "添加说明文字...",
    "ja": "キャプションを追加...",
    "ko": "캡션 추가...",
    "ar": "إضافة شرح...",
    "ru": "Добавить описание..."
  },
  "Atrás": {
    "es": "Atrás",
    "en": "Back",
    "fr": "Retour",
    "de": "Zurück",
    "it": "Indietro",
    "pt": "Voltar",
    "zh": "返回",
    "ja": "戻る",
    "ko": "뒤로",
    "ar": "رجوع",
    "ru": "Назад"
  },
  "Reacciones": {
    "es": "Reacciones",
    "en": "React",
    "fr": "Réagir",
    "de": "Reagieren",
    "it": "Reazioni",
    "pt": "Reações",
    "zh": "反应",
    "ja": "リアクション",
    "ko": "반응",
    "ar": "تفاعلات",
    "ru": "Реакции"
  },
  "Comentar": {
    "es": "Comentar",
    "en": "Comment",
    "fr": "Commenter",
    "de": "Kommentieren",
    "it": "Commenta",
    "pt": "Comentar",
    "zh": "评论",
    "ja": "コメント",
    "ko": "댓글",
    "ar": "تعليق",
    "ru": "Комментарий"
  },
  "Mostrar/ocultar título": {
    "es": "Mostrar/ocultar título",
    "en": "Toggle title",
    "fr": "Afficher/masquer titre",
    "de": "Titel umschalten",
    "it": "Mostra/nascondi titolo",
    "pt": "Mostrar/ocultar título",
    "zh": "显示/隐藏标题",
    "ja": "タイトルの表示切替",
    "ko": "제목 표시 전환",
    "ar": "إظهار/إخفاء العنوان",
    "ru": "Показать/скрыть заголовок"
  },
  "Título": {
    "es": "Título",
    "en": "Title",
    "fr": "Titre",
    "de": "Titel",
    "it": "Titolo",
    "pt": "Título",
    "zh": "标题",
    "ja": "タイトル",
    "ko": "제목",
    "ar": "العنوان",
    "ru": "Квалификация"
  },
  "Fecha límite": {
    "es": "Fecha límite",
    "en": "Due date",
    "fr": "Date limite",
    "de": "Fälligkeitsdatum",
    "it": "Scadenza",
    "pt": "Prazo",
    "zh": "截止日期",
    "ja": "期限",
    "ko": "마감일",
    "ar": "تاريخ الاستحقاق",
    "ru": "Крайний срок"
  },
  "Para": {
    "es": "Para",
    "en": "Due",
    "fr": "Pour",
    "de": "Fällig",
    "it": "Scadenza",
    "pt": "Para",
    "zh": "截止",
    "ja": "期限",
    "ko": "기한",
    "ar": "مستحق",
    "ru": "Для"
  },
  "Asignar": {
    "es": "Asignar",
    "en": "Assign",
    "fr": "Assigner",
    "de": "Zuweisen",
    "it": "Assegna",
    "pt": "Atribuir",
    "zh": "指派",
    "ja": "割り当て",
    "ko": "할당",
    "ar": "تعيين",
    "ru": "Назначать"
  },
  "Aumentar sangría": {
    "es": "Aumentar sangría",
    "en": "Indent",
    "fr": "Augmenter le retrait",
    "de": "Einrücken",
    "it": "Aumenta rientro",
    "pt": "Aumentar recuo",
    "zh": "增加缩进",
    "ja": "インデント",
    "ko": "들여쓰기",
    "ar": "زيادة المسافة البادئة",
    "ru": "Увеличить отступ"
  },
  "Indentar": {
    "es": "Indentar",
    "en": "Indent",
    "fr": "Indenter",
    "de": "Einrücken",
    "it": "Rientra",
    "pt": "Indentar",
    "zh": "缩进",
    "ja": "インデント",
    "ko": "들여쓰기",
    "ar": "مسافة بادئة",
    "ru": "Отступ"
  },
  "Reducir sangría": {
    "es": "Reducir sangría",
    "en": "Outdent",
    "fr": "Diminuer le retrait",
    "de": "Ausrücken",
    "it": "Riduci rientro",
    "pt": "Diminuir recuo",
    "zh": "减少缩进",
    "ja": "アウトデント",
    "ko": "내어쓰기",
    "ar": "تقليل المسافة البادئة",
    "ru": "Уменьшить отступ"
  },
  "Desindentar": {
    "es": "Desindentar",
    "en": "Outdent",
    "fr": "Désindenter",
    "de": "Ausrücken",
    "it": "Riduci rientro",
    "pt": "Desindentar",
    "zh": "减少缩进",
    "ja": "アウトデント",
    "ko": "내어쓰기",
    "ar": "إلغاء المسافة البادئة",
    "ru": "Несогласный"
  },
  "Alternar vista previa": {
    "es": "Alternar vista previa",
    "en": "Toggle preview",
    "fr": "Basculer l'aperçu",
    "de": "Vorschau umschalten",
    "it": "Attiva anteprima",
    "pt": "Alternar visualização",
    "zh": "切换预览",
    "ja": "プレビュー切替",
    "ko": "미리보기 전환",
    "ar": "تبديل المعاينة",
    "ru": "Переключить предварительный просмотр"
  },
  "Vista previa": {
    "es": "Vista previa",
    "en": "Preview",
    "fr": "Aperçu",
    "de": "Vorschau",
    "it": "Anteprima",
    "pt": "Visualização",
    "zh": "预览",
    "ja": "プレビュー",
    "ko": "미리보기",
    "ar": "معاينة",
    "ru": "Предварительный просмотр"
  },
  "Mostrar informacion": {
    "es": "Mostrar informacion",
    "en": "Show info",
    "fr": "Afficher les infos",
    "de": "Info anzeigen",
    "it": "Mostra informazioni",
    "pt": "Mostrar informações",
    "zh": "显示信息",
    "ja": "情報の表示",
    "ko": "정보 표시",
    "ar": "إظهار المعلومات",
    "ru": "Показать информацию"
  },
  "Leyenda": {
    "es": "Leyenda",
    "en": "Caption",
    "fr": "Légende",
    "de": "Unterschrift",
    "it": "Didascalia",
    "pt": "Legenda",
    "zh": "说明文字",
    "ja": "キャプション",
    "ko": "캡션",
    "ar": "شرح",
    "ru": "Легенда"
  },
  "Abrir enlace": {
    "es": "Abrir enlace",
    "en": "Open link",
    "fr": "Ouvrir le lien",
    "de": "Link öffnen",
    "it": "Apri link",
    "pt": "Abrir link",
    "zh": "打开链接",
    "ja": "リンクを開く",
    "ko": "링크 열기",
    "ar": "فتح الرابط",
    "ru": "Открыть ссылку"
  },
  "Abrir": {
    "es": "Abrir",
    "en": "Open",
    "fr": "Ouvrir",
    "de": "Öffnen",
    "it": "Apri",
    "pt": "Abrir",
    "zh": "打开",
    "ja": "開く",
    "ko": "열기",
    "ar": "فتح",
    "ru": "Открыть"
  },
  "Cambiar icono": {
    "es": "Cambiar icono",
    "en": "Change icon",
    "fr": "Modifier l'icône",
    "de": "Symbol ändern",
    "it": "Cambia icona",
    "pt": "Alterar ícone",
    "zh": "更改图标",
    "ja": "アイコン変更",
    "ko": "아이콘 변경",
    "ar": "تغيير الأيقونة",
    "ru": "Изменить значок"
  },
  "Icono": {
    "es": "Icono",
    "en": "Icon",
    "fr": "Icône",
    "de": "Symbol",
    "it": "Icona",
    "pt": "Ícone",
    "zh": "图标",
    "ja": "アイコン",
    "ko": "아이콘",
    "ar": "أيقونة",
    "ru": "Икона"
  },
  "Bucle": {
    "es": "Bucle",
    "en": "Loop",
    "fr": "Boucle",
    "de": "Schleife",
    "it": "Loop",
    "pt": "Loop",
    "zh": "循环",
    "ja": "ループ",
    "ko": "루프",
    "ar": "تكرار",
    "ru": "Петля"
  },
  "Mostrar HEX": {
    "es": "Mostrar HEX",
    "en": "Show HEX",
    "fr": "Afficher HEX",
    "de": "HEX anzeigen",
    "it": "Mostra HEX",
    "pt": "Mostrar HEX",
    "zh": "显示HEX",
    "ja": "HEX表示",
    "ko": "HEX 표시",
    "ar": "إظهار HEX",
    "ru": "Показать шестнадцатеричный"
  },
  "Descargar PDF": {
    "es": "Descargar PDF",
    "en": "Download PDF",
    "fr": "Télécharger PDF",
    "de": "PDF herunterladen",
    "it": "Scarica PDF",
    "pt": "Baixar PDF",
    "zh": "下载PDF",
    "ja": "PDFダウンロード",
    "ko": "PDF 다운로드",
    "ar": "تنزيل PDF",
    "ru": "Скачать PDF"
  },
  "Descargar": {
    "es": "Descargar",
    "en": "Download",
    "fr": "Télécharger",
    "de": "Herunterladen",
    "it": "Scarica",
    "pt": "Baixar",
    "zh": "下载",
    "ja": "ダウンロード",
    "ko": "다운로드",
    "ar": "تنزيل",
    "ru": "Увольнять"
  },
  "Estilo": {
    "es": "Estilo",
    "en": "Style",
    "fr": "Style",
    "de": "Stil",
    "it": "Stile",
    "pt": "Estilo",
    "zh": "样式",
    "ja": "スタイル",
    "ko": "스타일",
    "ar": "نمط",
    "ru": "Стиль"
  },
  "Fórmula (= en la celda)": {
    "es": "Fórmula (= en la celda)",
    "en": "Formula (= in cell)",
    "fr": "Formule (= dans cellule)",
    "de": "Formel (= in Zelle)",
    "it": "Formula (= nella cella)",
    "pt": "Fórmula (= na célula)",
    "zh": "公式（在单元格中输入 =）",
    "ja": "数式（セル内に=）",
    "ko": "수식 (셀에 = 입력)",
    "ar": "صيغة (= في الخلية)",
    "ru": "Формула (= в ячейке)"
  },
  "Fórmula": {
    "es": "Fórmula",
    "en": "Formula",
    "fr": "Formule",
    "de": "Formel",
    "it": "Formula",
    "pt": "Fórmula",
    "zh": "公式",
    "ja": "数式",
    "ko": "수식",
    "ar": "صيغة",
    "ru": "Формула"
  },
  "Alineación": {
    "es": "Alineación",
    "en": "Alignment",
    "fr": "Alignement",
    "de": "Ausrichtung",
    "it": "Allineamento",
    "pt": "Alinhamento",
    "zh": "对齐",
    "ja": "配置",
    "ko": "정렬",
    "ar": "محاذاة",
    "ru": "Выравнивание"
  },
  "Align": {
    "es": "Align",
    "en": "Align",
    "fr": "Aligner",
    "de": "Ausrichten",
    "it": "Allinea",
    "pt": "Alinhar",
    "zh": "对齐",
    "ja": "配置",
    "ko": "정렬",
    "ar": "محاذاة",
    "ru": "Выровнять"
  },
  "Añadir columna": {
    "es": "Añadir columna",
    "en": "Add column",
    "fr": "Ajouter colonne",
    "de": "Spalte hinzufügen",
    "it": "Aggiungi colonna",
    "pt": "Adicionar coluna",
    "zh": "添加列",
    "ja": "列を追加",
    "ko": "열 추가",
    "ar": "إضافة عمود",
    "ru": "Добавить столбец"
  },
  "Columna": {
    "es": "Columna",
    "en": "Column",
    "fr": "Colonne",
    "de": "Spalte",
    "it": "Colonna",
    "pt": "Coluna",
    "zh": "列",
    "ja": "列",
    "ko": "열",
    "ar": "عمود",
    "ru": "Столбец"
  },
  "Añadir fila": {
    "es": "Añadir fila",
    "en": "Add row",
    "fr": "Ajouter ligne",
    "de": "Zeile hinzufügen",
    "it": "Aggiungi riga",
    "pt": "Adicionar linha",
    "zh": "添加行",
    "ja": "行を追加",
    "ko": "행 추가",
    "ar": "إضافة صف",
    "ru": "Добавить строку"
  },
  "Eliminar columna": {
    "es": "Eliminar columna",
    "en": "Delete column",
    "fr": "Supprimer colonne",
    "de": "Spalte löschen",
    "it": "Elimina colonna",
    "pt": "Excluir coluna",
    "zh": "删除列",
    "ja": "列を削除",
    "ko": "열 삭제",
    "ar": "حذف العمود",
    "ru": "Удалить столбец"
  },
  "Eliminar fila": {
    "es": "Eliminar fila",
    "en": "Remove row",
    "fr": "Supprimer ligne",
    "de": "Zeile entfernen",
    "it": "Rimuovi riga",
    "pt": "Remover linha",
    "zh": "删除行",
    "ja": "行を削除",
    "ko": "행 제거",
    "ar": "إزالة الصف",
    "ru": "Удалить строку"
  },
  "Eliminar": {
    "es": "Eliminar",
    "en": "Delete",
    "fr": "Supprimer",
    "de": "Löschen",
    "it": "Elimina",
    "pt": "Excluir",
    "zh": "删除",
    "ja": "削除",
    "ko": "삭제",
    "ar": "حذف",
    "ru": "Устранять"
  },
  "Exportar CSV": {
    "es": "Exportar CSV",
    "en": "Export CSV",
    "fr": "Exporter CSV",
    "de": "CSV exportieren",
    "it": "Esporta CSV",
    "pt": "Exportar CSV",
    "zh": "导出CSV",
    "ja": "CSVエクスポート",
    "ko": "CSV 내보내기",
    "ar": "تصدير CSV",
    "ru": "Экспорт CSV"
  },
  "Importar archivo": {
    "es": "Importar archivo",
    "en": "Import file",
    "fr": "Importer fichier",
    "de": "Datei importieren",
    "it": "Importa file",
    "pt": "Importar arquivo",
    "zh": "导入文件",
    "ja": "ファイルをインポート",
    "ko": "파일 가져오기",
    "ar": "استيراد ملف",
    "ru": "Импортировать файл"
  },
  "Exportar": {
    "es": "Exportar",
    "en": "Export",
    "fr": "Exporter",
    "de": "Exportieren",
    "it": "Esporta",
    "pt": "Exportar",
    "zh": "导出",
    "ja": "エクスポート",
    "ko": "내보내기",
    "ar": "تصدير",
    "ru": "Экспорт"
  },
  "Importar": {
    "es": "Importar",
    "en": "Import",
    "fr": "Importer",
    "de": "Importieren",
    "it": "Importa",
    "pt": "Importar",
    "zh": "导入",
    "ja": "インポート",
    "ko": "가져오기",
    "ar": "استيراد",
    "ru": "Иметь значение"
  },
  "Color": {
    "es": "Color",
    "en": "Color",
    "fr": "Couleur",
    "de": "Farbe",
    "it": "Colore",
    "pt": "Cor",
    "zh": "颜色",
    "ja": "色",
    "ko": "색상",
    "ar": "لون",
    "ru": "Цвет"
  },
  "Tamaño": {
    "es": "Tamaño",
    "en": "Size",
    "fr": "Taille",
    "de": "Größe",
    "it": "Dimensione",
    "pt": "Tamanho",
    "zh": "大小",
    "ja": "サイズ",
    "ko": "크기",
    "ar": "حجم",
    "ru": "Размер"
  },
  "Eliminar nota": {
    "es": "Eliminar nota",
    "en": "Delete note",
    "fr": "Supprimer note",
    "de": "Notiz löschen",
    "it": "Elimina nota",
    "pt": "Excluir nota",
    "zh": "删除便签",
    "ja": "メモを削除",
    "ko": "노트 삭제",
    "ar": "حذف الملاحظة",
    "ru": "Удалить заметку"
  },
  "Eliminar enlace": {
    "es": "Eliminar enlace",
    "en": "Delete link",
    "fr": "Supprimer lien",
    "de": "Link löschen",
    "it": "Elimina link",
    "pt": "Excluir link",
    "zh": "删除链接",
    "ja": "リンクを削除",
    "ko": "링크 삭제",
    "ar": "حذف الرابط",
    "ru": "Удалить ссылку"
  },
  "Eliminar tarea": {
    "es": "Eliminar tarea",
    "en": "Delete task",
    "fr": "Supprimer tâche",
    "de": "Aufgabe löschen",
    "it": "Elimina attività",
    "pt": "Excluir tarefa",
    "zh": "删除任务",
    "ja": "タスクを削除",
    "ko": "할 일 삭제",
    "ar": "حذف المهمة",
    "ru": "Удалить задачу"
  },
  "Eliminar conector": {
    "es": "Eliminar conector",
    "en": "Delete connection",
    "fr": "Supprimer connexion",
    "de": "Verbindung löschen",
    "it": "Elimina connessione",
    "pt": "Excluir conexão",
    "zh": "删除连接",
    "ja": "接続を削除",
    "ko": "연결 삭제",
    "ar": "حذف الاتصال",
    "ru": "Удалить соединитель"
  },
  "Eliminar tablero": {
    "es": "Eliminar tablero",
    "en": "Delete board",
    "fr": "Supprimer tableau",
    "de": "Board löschen",
    "it": "Elimina tavola",
    "pt": "Excluir quadro",
    "zh": "删除看板",
    "ja": "ボードを削除",
    "ko": "보드 삭제",
    "ar": "حذف اللوحة",
    "ru": "Удалить доску"
  },
  "Eliminar tabla": {
    "es": "Eliminar tabla",
    "en": "Delete table",
    "fr": "Supprimer tableau",
    "de": "Tabelle löschen",
    "it": "Elimina tabella",
    "pt": "Excluir tabela",
    "zh": "删除表格",
    "ja": "テーブルを削除",
    "ko": "표 삭제",
    "ar": "حذف الجدول",
    "ru": "Удалить таблицу"
  },
  "Eliminar calendario": {
    "es": "Eliminar calendario",
    "en": "Delete calendar",
    "fr": "Supprimer calendrier",
    "de": "Kalender löschen",
    "it": "Elimina calendario",
    "pt": "Excluir calendário",
    "zh": "删除日历",
    "ja": "カレンダーを削除",
    "ko": "캘린더 삭제",
    "ar": "حذف التقويم",
    "ru": "Удалить календарь"
  },
  "Eliminar comentario": {
    "es": "Eliminar comentario",
    "en": "Delete comment",
    "fr": "Supprimer commentaire",
    "de": "Kommentar löschen",
    "it": "Elimina commento",
    "pt": "Excluir comentário",
    "zh": "删除评论",
    "ja": "コメントを削除",
    "ko": "댓글 삭제",
    "ar": "حذف التعليق",
    "ru": "Удалить комментарий"
  },
  "Eliminar imagen": {
    "es": "Eliminar imagen",
    "en": "Delete image",
    "fr": "Supprimer image",
    "de": "Bild löschen",
    "it": "Elimina immagine",
    "pt": "Excluir imagem",
    "zh": "删除图片",
    "ja": "画像を削除",
    "ko": "이미지 삭제",
    "ar": "حذف الصورة",
    "ru": "Удалить изображение"
  },
  "Eliminar documento": {
    "es": "Eliminar documento",
    "en": "Delete document",
    "fr": "Supprimer document",
    "de": "Dokument löschen",
    "it": "Elimina documento",
    "pt": "Excluir documento",
    "zh": "删除文档",
    "ja": "ドキュメントを削除",
    "ko": "문서 삭제",
    "ar": "حذف المستند",
    "ru": "Удалить документ"
  },
  "Eliminar archivo": {
    "es": "Eliminar archivo",
    "en": "Delete file",
    "fr": "Supprimer fichier",
    "de": "Datei löschen",
    "it": "Elimina file",
    "pt": "Excluir arquivo",
    "zh": "删除文件",
    "ja": "ファイルを削除",
    "ko": "파일 삭제",
    "ar": "حذف الملف",
    "ru": "Удалить файл"
  },
  "Eliminar audio": {
    "es": "Eliminar audio",
    "en": "Delete audio",
    "fr": "Supprimer audio",
    "de": "Audio löschen",
    "it": "Elimina audio",
    "pt": "Excluir áudio",
    "zh": "删除音频",
    "ja": "オーディオを削除",
    "ko": "오디오 삭제",
    "ar": "حذف الصوت",
    "ru": "Удалить аудио"
  },
  "Color de fondo del lienzo": {
    "es": "Color de fondo del lienzo",
    "en": "Canvas background color",
    "fr": "Couleur de fond du canevas",
    "de": "Leinwand Hintergrundfarbe",
    "it": "Colore di sfondo della tela",
    "pt": "Cor de fundo da tela",
    "zh": "画布背景颜色",
    "ja": "キャンバスの背景色",
    "ko": "캔버스 배경색",
    "ar": "لون خلفية اللوحة",
    "ru": "Цвет фона холста"
  },
  "Fondo del Lienzo": {
    "es": "Fondo del Lienzo",
    "en": "Canvas Background",
    "fr": "Fond du canevas",
    "de": "Leinwand Hintergrund",
    "it": "Sfondo della tela",
    "pt": "Fundo da tela",
    "zh": "画布背景",
    "ja": "キャンバスの背景",
    "ko": "캔버스 배경",
    "ar": "خلفية اللوحة",
    "ru": "Холст фон"
  },
  "Cambiar fondo del lienzo": {
    "es": "Cambiar fondo del lienzo",
    "en": "Change canvas background",
    "fr": "Modifier le fond du canevas",
    "de": "Leinwand Hintergrund ändern",
    "it": "Cambia sfondo della tela",
    "pt": "Alterar fundo da tela",
    "zh": "修改画布背景",
    "ja": "キャンバスの背景変更",
    "ko": "캔버스 배경 변경",
    "ar": "تغيير خلفية اللوحة",
    "ru": "Изменение фона холста"
  },
  "Curva": {
    "es": "Curva",
    "en": "Curve",
    "fr": "Courbe",
    "de": "Kurve",
    "it": "Curva",
    "pt": "Curva",
    "zh": "曲线",
    "ja": "カーブ",
    "ko": "곡선",
    "ar": "منحنى",
    "ru": "Изгиб"
  },
  "Recta": {
    "es": "Recta",
    "en": "Right-angle",
    "fr": "Angle droit",
    "de": "Rechter Winkel",
    "it": "Angolo retto",
    "pt": "Ângulo reto",
    "zh": "直角",
    "ja": "直角",
    "ko": "직각",
    "ar": "زاوية قائمة",
    "ru": "Прямой"
  },
  "Sólida": {
    "es": "Sólida",
    "en": "Solid",
    "fr": "Plein",
    "de": "Durchgehend",
    "it": "Continua",
    "pt": "Sólido",
    "zh": "实线",
    "ja": "実线",
    "ko": "실선",
    "ar": "صلب",
    "ru": "Твердый"
  },
  "Discontinua": {
    "es": "Discontinua",
    "en": "Dashed",
    "fr": "Pointillé",
    "de": "Gestrichelt",
    "it": "Tratteggiata",
    "pt": "Tracejado",
    "zh": "虚线",
    "ja": "破線",
    "ko": "점선",
    "ar": "متقطع",
    "ru": "Прерывистый"
  },
  "Punteada": {
    "es": "Punteada",
    "en": "Dotted",
    "fr": "Pointillé fin",
    "de": "Gepunktet",
    "it": "Puntinata",
    "pt": "Pontilhado",
    "zh": "点线",
    "ja": "点線",
    "ko": "점선(細)",
    "ar": "منقط",
    "ru": "Пунктирный"
  },
  "Doble": {
    "es": "Doble",
    "en": "Two-way",
    "fr": "Double sens",
    "de": "Zwei-Wege",
    "it": "Doppio senso",
    "pt": "Duplo sentido",
    "zh": "双向",
    "ja": "双方向",
    "ko": "양방향",
    "ar": "اتجاهين",
    "ru": "Двойной"
  },
  "Flecha bidireccional": {
    "es": "Flecha bidireccional",
    "en": "Bidirectional arrow",
    "fr": "Flèche bidirectionnelle",
    "de": "Bidirektionaler Pfeil",
    "it": "Freccia bidirezionale",
    "pt": "Seta bidirecional",
    "zh": "双向箭头",
    "ja": "双方向矢印",
    "ko": "양방향 화살표",
    "ar": "سهم ثنائي الاتجاه",
    "ru": "Двунаправленная стрелка"
  },
  "Etiqueta": {
    "es": "Etiqueta",
    "en": "Label",
    "fr": "Étiquette",
    "de": "Beschriftung",
    "it": "Etichetta",
    "pt": "Etiqueta",
    "zh": "标签",
    "ja": "ラベル",
    "ko": "라벨",
    "ar": "ملصق",
    "ru": "Этикетка"
  },
  "Etiqueta…": {
    "es": "Etiqueta…",
    "en": "Label…",
    "fr": "Étiquette…",
    "de": "Beschriftung…",
    "it": "Etichetta…",
    "pt": "Etiqueta…",
    "zh": "标签…",
    "ja": "ラベル…",
    "ko": "라벨…",
    "ar": "ملصق…",
    "ru": "Этикетка…"
  },
  "Arrastra de un nodo a otro": {
    "es": "Arrastra de un nodo a otro",
    "en": "Drag from one node to another",
    "fr": "Faites glisser d'un nœud à un autre",
    "de": "Von einem Knoten zum anderen ziehen",
    "it": "Trascina da un nodo all'altro",
    "pt": "Arraste de um nó para outro",
    "zh": "从一个节点拖动到另一个节点",
    "ja": "ノードからノードへドラッグ",
    "ko": "한 노드에서 다른 노드로 드래그",
    "ar": "اسحب من عقدة إلى أخرى",
    "ru": "Перетаскивание с одного узла на другой"
  },
  "Guardado": {
    "es": "Guardado",
    "en": "Saved",
    "fr": "Enregistré",
    "de": "Gespeichert",
    "it": "Salva",
    "pt": "Salvo",
    "zh": "已保存",
    "ja": "保存済",
    "ko": "저장됨",
    "ar": "تم الحفظ",
    "ru": "Сохранено"
  },
  "Deshacer": {
    "es": "Deshacer",
    "en": "Undo",
    "fr": "Annuler",
    "de": "Rückgängig machen",
    "it": "Annulla",
    "pt": "Desfazer",
    "zh": "撤销",
    "ja": "元に戻す",
    "ko": "실행 취소",
    "ar": "تراجع",
    "ru": "Отменить"
  },
  "Seleccionar todo": {
    "es": "Seleccionar todo",
    "en": "Select all",
    "fr": "Tout sélectionner",
    "de": "Alles auswählen",
    "it": "Seleziona tutto",
    "pt": "Selecionar tudo",
    "zh": "全选",
    "ja": "すべて選択",
    "ko": "전체 선택",
    "ar": "تحديد الكل",
    "ru": "Выбрать все"
  },
  "Editar": {
    "es": "Editar",
    "en": "Edit",
    "fr": "Modifier",
    "de": "Bearbeiten",
    "it": "Modifica",
    "pt": "Editar",
    "zh": "编辑",
    "ja": "編集",
    "ko": "편집",
    "ar": "تعديل",
    "ru": "Редактировать"
  },
  "Abrir documento": {
    "es": "Abrir documento",
    "en": "Open document",
    "fr": "Ouvrir le document",
    "de": "Dokument öffnen",
    "it": "Apri documento",
    "pt": "Abrir documento",
    "zh": "打开文档",
    "ja": "ドキュメントを開く",
    "ko": "문서 열기",
    "ar": "فتح المستند",
    "ru": "Открыть документ"
  },
  "Abrir tablero": {
    "es": "Abrir tablero",
    "en": "Open board",
    "fr": "Ouvrir le tableau",
    "de": "Board öffnen",
    "it": "Apri tavola",
    "pt": "Abrir quadro",
    "zh": "打开看板",
    "ja": "ボードを開く",
    "ko": "보드 열기",
    "ar": "فتح اللوحة",
    "ru": "Открытая доска"
  },
  "Duplicar": {
    "es": "Duplicar",
    "en": "Duplicate",
    "fr": "Dupliquer",
    "de": "Duplizieren",
    "it": "Duplica",
    "pt": "Duplicar",
    "zh": "复制",
    "ja": "複製",
    "ko": "복제",
    "ar": "تكرار",
    "ru": "Двойной"
  },
  "Tú": {
    "es": "Tú",
    "en": "You",
    "fr": "Vous",
    "de": "Du/Sie",
    "it": "Tu",
    "pt": "Você",
    "zh": "你",
    "ja": "あなた",
    "ko": "나",
    "ar": "أنت",
    "ru": "Ты"
  },
  "Bóveda Local": {
    "es": "Bóveda Local",
    "en": "Local Vault",
    "fr": "Coffre local",
    "de": "Lokaler Safe",
    "it": "Vault locale",
    "pt": "Cofre local",
    "zh": "本地保险库",
    "ja": "ローカル保管庫",
    "ko": "로컬 보관소",
    "ar": "الخزنة المحلية",
    "ru": "Локальное хранилище"
  },
  "Desconectar Bóveda": {
    "es": "Desconectar Bóveda",
    "en": "Disconnect Vault",
    "fr": "Déconnecter le coffre",
    "de": "Safe trennen",
    "it": "Disconnetti vault",
    "pt": "Desconectar cofre",
    "zh": "断开保险库",
    "ja": "保管庫の接続解除",
    "ko": "보관소 연결 해제",
    "ar": "إلغاء اتصال الخزنة",
    "ru": "Отключить хранилище"
  },
  "Guarda todo directamente en carpetas de tu PC.": {
    "es": "Guarda todo directamente en carpetas de tu PC.",
    "en": "Save everything directly to folders on your PC.",
    "fr": "Enregistrez tout directement dans des dossiers sur votre PC.",
    "de": "Speichern Sie alles direkt in Ordnern auf Ihrem PC.",
    "it": "Salva tutto direttamente nelle cartelle del tuo PC.",
    "pt": "Salve tudo diretamente nas pastas do seu PC.",
    "zh": "将所有内容直接保存到您电脑的文件夹中。",
    "ja": "PC上のフォルダに直接すべてを保存します。",
    "ko": "PC의 폴더에 직접 모든 내용을 저장하세요.",
    "ar": "احفظ كل شيء مباشرة في مجلدات جهاز الكمبيوتر الخاص بك.",
    "ru": "Сохраняйте все прямо в папки на вашем компьютере."
  },
  "Abrir Carpeta": {
    "es": "Abrir Carpeta",
    "en": "Open Folder",
    "fr": "Ouvrir le dossier",
    "de": "Ordner öffnen",
    "it": "Apri cartella",
    "pt": "Abrir pasta",
    "zh": "打开文件夹",
    "ja": "フォルダを開く",
    "ko": "폴더 열기",
    "ar": "فتح المجلد",
    "ru": "Открыть папку"
  },
  "Disponible en la versión de escritorio para PC.": {
    "es": "Disponible en la versión de escritorio para PC.",
    "en": "Available in the desktop version for PC.",
    "fr": "Disponible sur la version de bureau pour PC.",
    "de": "Verfügbar in der Desktop-Version für PC.",
    "it": "Disponibile nella versione desktop per PC.",
    "pt": "Disponível na versão desktop para PC.",
    "zh": "可在PC的桌面版中使用。",
    "ja": "PC向けデスクトップ版でご利用いただけます。",
    "ko": "PC 데스크톱 버전에서 사용 가능합니다.",
    "ar": "متوفر في نسخة سطح المكتب لأجهزة الكمبيوتر.",
    "ru": "Доступна настольная версия для ПК."
  },
  "Apoya Oddinote": {
    "es": "Apoya Oddinote",
    "en": "Support Oddinote",
    "fr": "Soutenir Oddinote",
    "de": "Oddinote unterstützen",
    "it": "Sostieni Oddinote",
    "pt": "Apoiar Oddinote",
    "zh": "支持 Oddinote",
    "ja": "Oddinoteをサポート",
    "ko": "Oddinote 후원하기",
    "ar": "دعم أودينوت",
    "ru": "Поддержка Одиноте"
  },
  "Oddinote es 100% gratis y de código abierto. Si te es útil, considera apoyarnos para mantener el proyecto.": {
    "es": "Oddinote es 100% gratis y de código abierto. Si te es útil, considera apoyarnos para mantener el proyecto.",
    "en": "Oddinote is 100% free and open source. If you find it useful, consider supporting us to maintain the project.",
    "fr": "Oddinote est 100 % gratuit et open source. Si vous le trouvez utile, pensez à nous soutenir.",
    "de": "Oddinote ist 100% kostenlos und Open Source. Wenn es Ihnen nützlich ist, unterstützen Sie uns bitte.",
    "it": "Oddinote è gratuito al 100% e open source. Se lo trovi utile, considera di sostenerci.",
    "pt": "Oddinote é 100% gratuito e de código aberto. Se for útil, considere apoiar-nos.",
    "zh": "Oddinote 是 100% 免费且开源的。如果您觉得有用，请考虑支持我们以维持项目。",
    "ja": "Oddinoteは100%無料でオープンソースです。便利だと思ったら、プロジェクト継続のために支援をご検討ください。",
    "ko": "Oddinote는 100% 무료이며 오픈 소스입니다. 유용하다고 생각하시면 프로젝트 유지를 위한 후원을 고려해 주세요.",
    "ar": "أودينوت مجاني ومفتوح المصدر بنسبة 100٪. إذا كان مفيدًا لك، فيرجى التفكير في دعمنا للاستمرار.",
    "ru": "Oddinote на 100% бесплатен и имеет открытый исходный код. Если это будет вам полезно, рассмотрите возможность поддержать нас в поддержании проекта."
  },
  "Apoyar en Ko-fi": {
    "es": "Apoyar en Ko-fi",
    "en": "Support on Ko-fi",
    "fr": "Soutenir sur Ko-fi",
    "de": "Auf Ko-fi unterstützen",
    "it": "Sostieni su Ko-fi",
    "pt": "Apoiar no Ko-fi",
    "zh": "在 Ko-fi 上支持",
    "ja": "Ko-fiでサポート",
    "ko": "Ko-fi에서 후원하기",
    "ar": "الدعم على Ko-fi",
    "ru": "Поддержка на Ко-фи"
  },
  "Apoyar": {
    "es": "Apoyar",
    "en": "Support",
    "fr": "Soutenir",
    "de": "Unterstützen",
    "it": "Sostieni",
    "pt": "Apoiar",
    "zh": "支持",
    "ja": "サポート",
    "ko": "후원",
    "ar": "دعم",
    "ru": "Поддерживать"
  },
  "Apóyame en Ko-fi": {
    "es": "Apóyame en Ko-fi",
    "en": "Support me on Ko-fi",
    "fr": "Soutenez-moi sur Ko-fi",
    "de": "Unterstütze mich auf Ko-fi",
    "it": "Sostienimi su Ko-fi",
    "pt": "Apoie-me no Ko-fi",
    "zh": "在 Ko-fi 上支持我",
    "ja": "Ko-fiで支援する",
    "ko": "Ko-fi에서 저를 후원해 주세요",
    "ar": "ادعمني على Ko-fi",
    "ru": "Поддержите меня на Ко-фи"
  },
  "¡Nueva actualización disponible! Haz clic para descargar de GitHub.": {
    "es": "¡Nueva actualización disponible! Haz clic para descargar de GitHub.",
    "en": "New update available! Click to download from GitHub.",
    "fr": "Nouvelle mise à jour disponible ! Cliquez pour télécharger depuis GitHub.",
    "de": "Neue Version verfügbar! Klicken zum Herunterladen von GitHub.",
    "it": "Nuovo aggiornamento disponibile! Clicca per scaricare da GitHub.",
    "pt": "Nova atualização disponível! Clique para baixar do GitHub.",
    "zh": "有新更新可用！点击从 GitHub 下载。",
    "ja": "新しいアップデートがあります！クリックしてGitHubからダウンロードします。",
    "ko": "새로운 업데이트가 있습니다! GitHub에서 다운로드하려면 클릭하세요.",
    "ar": "تحديث جديد متاح! انقر للتنزيل من GitHub.",
    "ru": "Доступно новое обновление! Нажмите, чтобы загрузить с GitHub."
  },
  "Buscar actualizaciones": {
    "es": "Buscar actualizaciones",
    "en": "Check for updates",
    "fr": "Vérifier les mises à jour",
    "de": "Auf Updates prüfen",
    "it": "Verifica aggiornamenti",
    "pt": "Verificar atualizações",
    "zh": "检查更新",
    "ja": "アップデートを確認",
    "ko": "업데이트 확인",
    "ar": "التحقق من وجود تحديثات",
    "ru": "Проверьте наличие обновлений"
  },
  "recién": {
    "es": "recién",
    "en": "recent",
    "fr": "récent",
    "de": "vor kurzem",
    "it": "recente",
    "pt": "recente",
    "zh": "最近",
    "ja": "最近",
    "ko": "최근",
    "ar": "حديث",
    "ru": "недавно"
  },
  "Abrir en navegador": {
    "es": "Abrir en navegador",
    "en": "Open in browser",
    "fr": "Ouvrir dans le navigateur",
    "de": "Im Browser öffnen",
    "it": "Apri nel browser",
    "pt": "Abrir no navegador",
    "zh": "在浏览器中打开",
    "ja": "ブラウザで開く",
    "ko": "브라우저에서 열기",
    "ar": "فتح في المتصفح",
    "ru": "Открыть в браузере"
  },
  "Apoyar de forma directa": {
    "es": "Apoyar de forma directa",
    "en": "Direct support",
    "fr": "Soutien direct",
    "de": "Direkte Unterstützung",
    "it": "Supporto diretto",
    "pt": "Apoio direto",
    "zh": "直接支持",
    "ja": "直接支援",
    "ko": "직접 후원",
    "ar": "دعم مباشر",
    "ru": "Поддержка напрямую"
  },
  "Donadores Recientes": {
    "es": "Donadores Recientes",
    "en": "Recent Donors",
    "fr": "Donateurs récents",
    "de": "Letzte Spender",
    "it": "Donatori recenti",
    "pt": "Doadores recentes",
    "zh": "最近捐赠者",
    "ja": "最近の支援者",
    "ko": "최근 후원자",
    "ar": "المتبرعون المحدثون",
    "ru": "Недавние доноры"
  },
  "Gracias a estas personas por hacer posible Oddinote": {
    "es": "Gracias a estas personas por hacer posible Oddinote",
    "en": "Thanks to these people for making Oddinote possible",
    "fr": "Merci à ces personnes de rendre Oddinote possible",
    "de": "Danke an diese Personen, die Oddinote möglich machen",
    "it": "Grazie a queste persone per aver reso possibile Oddinote",
    "pt": "Agradecemos a estas pessoas por tornarem o Oddinote possível",
    "zh": "感谢这些让 Oddinote 成为可能的人们",
    "ja": "Oddinoteの実現にご協力いただいた皆様に感謝いたします",
    "ko": "Oddinote를 가능하게 해주신 분들께 감사드립니다",
    "ar": "شكراً لهؤلاء الأشخاص لجعل أودينوت ممكناً",
    "ru": "Спасибо этим людям за то, что сделали Oddinote возможным."
  },
  "Añade una leyenda…": {
    "es": "Añade una leyenda…",
    "en": "Add a caption…",
    "fr": "Ajouter une légende…",
    "de": "Beschriftung hinzufügen…",
    "it": "Aggiungi una didascalia…",
    "pt": "Adicione uma legenda…",
    "zh": "添加说明文字…",
    "ja": "キャプションを追加…",
    "ko": "캡션 추가…",
    "ar": "إضافة شرح…",
    "ru": "Добавьте легенду…"
  },
  "Nuevo tablero": {
    "es": "Nuevo tablero",
    "en": "New board",
    "fr": "Nouveau tableau",
    "de": "Neues Board",
    "it": "Nuova tavola",
    "pt": "Novo quadro",
    "zh": "新看板",
    "ja": "新規ボード",
    "ko": "새 보드",
    "ar": "لوحة جديدة",
    "ru": "Новая доска"
  },
  "Nueva tarea": {
    "es": "Nueva tarea",
    "en": "New task",
    "fr": "Nouvelle tâche",
    "de": "Neue Aufgabe",
    "it": "Nuova attività",
    "pt": "Nova tarefa",
    "zh": "新任务",
    "ja": "新規タスク",
    "ko": "새 할 일",
    "ar": "مهمة جديدة",
    "ru": "Новая задача"
  },
  "Nueva nota": {
    "es": "Nueva nota",
    "en": "New note",
    "fr": "Nouvelle note",
    "de": "Neue Notiz",
    "it": "Nuova nota",
    "pt": "Nova nota",
    "zh": "新便签",
    "ja": "新規メモ",
    "ko": "새 노트",
    "ar": "ملاحظة جديدة",
    "ru": "Новая заметка"
  },
  "Nueva columna": {
    "es": "Nueva columna",
    "en": "New column",
    "fr": "Nouvelle colonne",
    "de": "Neue Spalte",
    "it": "Nuova colonna",
    "pt": "Nova coluna",
    "zh": "新列栏",
    "ja": "新規カラム",
    "ko": "새 열",
    "ar": "عمود جديد",
    "ru": "Новый столбец"
  },
  "Nuevo documento": {
    "es": "Nuevo documento",
    "en": "New document",
    "fr": "Nouveau document",
    "de": "Neues Dokument",
    "it": "Nuovo documento",
    "pt": "Novo documento",
    "zh": "新文档",
    "ja": "新規ドキュメント",
    "ko": "새 문서",
    "ar": "مستند جديد",
    "ru": "Новый документ"
  },
  "Nuevo calendario": {
    "es": "Nuevo calendario",
    "en": "New calendar",
    "fr": "Nouveau calendrier",
    "de": "Neuer Kalender",
    "it": "Nuovo calendario",
    "pt": "Novo calendário",
    "zh": "新日历",
    "ja": "新規カレンダー",
    "ko": "새 캘린더",
    "ar": "تقويم جديد",
    "ru": "Новый календарь"
  },
  "Nueva tabla": {
    "es": "Nueva tabla",
    "en": "New table",
    "fr": "Nouvelle table",
    "de": "Neue Tabelle",
    "it": "Nuova tabella",
    "pt": "Nova tabela",
    "zh": "新表格",
    "ja": "新規テーブル",
    "ko": "새 표",
    "ar": "جدول جديد",
    "ru": "Новый стол"
  },
  "Nuevo audio": {
    "es": "Nuevo audio",
    "en": "New audio",
    "fr": "Nouvel audio",
    "de": "Neues Audio",
    "it": "Nuovo audio",
    "pt": "Novo áudio",
    "zh": "新音频",
    "ja": "新規オーディオ",
    "ko": "새 오디오",
    "ar": "صوت جديد",
    "ru": "Новое аудио"
  },
  "Nuevo enlace": {
    "es": "Nuevo enlace",
    "en": "New link",
    "fr": "Nouveau lien",
    "de": "Neuer Link",
    "it": "Nuovo link",
    "pt": "Novo link",
    "zh": "新链接",
    "ja": "新規リンク",
    "ko": "새 링크",
    "ar": "رابط جديد",
    "ru": "Новая ссылка"
  },
  "Por favor selecciona un archivo de audio válido.": {
    "es": "Por favor selecciona un archivo de audio válido.",
    "en": "Please select a valid audio file.",
    "fr": "Veuillez sélectionner un fichier audio valide.",
    "de": "Bitte wählen Sie eine gültige Audiodatei aus.",
    "it": "Seleziona un file audio valido.",
    "pt": "Por favor, selecione um arquivo de áudio válido.",
    "zh": "请选择有效的音频文件。",
    "ja": "有効なオーディオファイルを選択してください。",
    "ko": "올바른 오디오 파일을 선택해 주세요.",
    "ar": "يرجى تحديد ملف صوتي صالح.",
    "ru": "Пожалуйста, выберите действительный аудиофайл."
  },
  "Clic para subir un audio": {
    "es": "Clic para subir un audio",
    "en": "Click to upload audio",
    "fr": "Cliquez pour charger un audio",
    "de": "Klicken zum Hochladen einer Audiodatei",
    "it": "Clicca per caricare un file audio",
    "pt": "Clique para carregar um áudio",
    "zh": "点击上传音频",
    "ja": "クリックしてオーディオをアップロード",
    "ko": "오디오를 업로드하려면 클릭하세요",
    "ar": "انقر لتحميل ملف صوتي",
    "ru": "Нажмите, чтобы загрузить аудио"
  },
  "No se pudieron comprobar las actualizaciones. Comprueba tu conexión.": {
    "es": "No se pudieron comprobar las actualizaciones. Comprueba tu conexión.",
    "en": "Could not check for updates. Please check your connection.",
    "fr": "Impossible de vérifier les mises à jour. Veuillez vérifier votre connexion.",
    "de": "Updates konnten nicht geprüft werden. Bitte überprüfen Sie Ihre Verbindung.",
    "it": "Impossibile verificare gli aggiornamenti. Controlla la tua connessione.",
    "pt": "Não foi possível verificar as atualizações. Verifique sua conexão.",
    "zh": "无法检查更新。请检查您的网络连接。",
    "ja": "アップデートを確認できませんでした。接続を確認してください。",
    "ko": "업데이트를 확인할 수 없습니다. 연결 상태를 확인해 주세요.",
    "ar": "تعذر التحقق من وجود تحديثات. يرجى التحقق من الاتصال.",
    "ru": "Не удалось проверить наличие обновлений. Проверьте свое соединение."
  },
  "¡Estás al día! Oddinote está en su versión más reciente (%v).": {
    "es": "¡Estás al día! Oddinote está en su versión más reciente (%v).",
    "en": "You are up to date! Oddinote is on the latest version (%v).",
    "fr": "Vous êtes à jour ! Oddinote est dans sa version la plus récente (%v).",
    "de": "Sie sind auf dem neuesten Stand! Oddinote ist in der neuesten Version (%v).",
    "it": "Sei al passo con gli aggiornamenti! Oddinote è all'ultima versione (%v).",
    "pt": "Você está atualizado! O Oddinote está na versão mais recente (%v).",
    "zh": "您已是最新版本！Oddinote 处于最新版本 (%v)。",
    "ja": "最新の状態です！Oddinoteは最新バージョン (%v) です。",
    "ko": "최신 버전입니다! Oddinote가 최신 버전(%v)입니다.",
    "ar": "أنت على أحدث إصدار! أودينوت في أحدث إصدار (%v).",
    "ru": "Вы в курсе! Oddinote находится в самой последней версии (%v)."
  },
  "No se pudo leer la boveda seleccionada.": {
    "es": "No se pudo leer la boveda seleccionada.",
    "en": "Could not read the selected vault.",
    "fr": "Impossible de lire le coffre sélectionné.",
    "de": "Ausgewählter Safe konnte nicht gelesen werden.",
    "it": "Impossibile leggere il vault selezionato.",
    "pt": "Não foi possível ler o cofre selecionado.",
    "zh": "无法读取所选保险库。",
    "ja": "選択した保管庫を読み取れませんでした。",
    "ko": "선택한 보관소를 읽을 수 없습니다.",
    "ar": "تعذر قراءة الخزنة المحددة.",
    "ru": "Не удалось прочитать выбранное хранилище."
  },
  "Este archivo no parece ser un respaldo valido de Oddinote.": {
    "es": "Este archivo no parece ser un respaldo valido de Oddinote.",
    "en": "This file does not look like a valid Oddinote backup.",
    "fr": "Ce fichier ne semble pas être une sauvegarde Oddinote valide.",
    "de": "Diese Datei scheint kein gültiges Oddinote-Backup zu sein.",
    "it": "Questo file non sembra un backup valido di Oddinote.",
    "pt": "Este arquivo não parece ser um backup válido do Oddinote.",
    "zh": "此文件似乎不是有效的 Oddinote 备份文件。",
    "ja": "このファイルは有効なOddinoteバックアップファイルではないようです。",
    "ko": "이 파일은 올바른 Oddinote 백업 파일이 아닌 것 같습니다.",
    "ar": "لا يبدو هذا الملف كنسخة احتياطية صالحة لأودينوت.",
    "ru": "Этот файл не является действительной резервной копией Oddinote."
  },
  "No se pudo importar el respaldo.": {
    "es": "No se pudo importar el respaldo.",
    "en": "The backup could not be imported.",
    "fr": "Impossible d'importer la sauvegarde.",
    "de": "Backup konnte nicht importiert werden.",
    "it": "Impossibile importare il backup.",
    "pt": "Não foi possível importar o backup.",
    "zh": "无法导入备份。",
    "ja": "バックアップをインポートできませんでした。",
    "ko": "백업을 가져올 수 없습니다.",
    "ar": "تعذر استيراد النسخة الاحتياطية.",
    "ru": "Резервную копию не удалось импортировать."
  }
};


// Translation helper supporting 10 languages reactively
window.t = function(es, en, fr, de, it, pt, zh, ja, ko, ar, ru) {
  const currentLang = window.currentLang || 'es';
  
  // Array parameters support (like dows days of week)
  if (Array.isArray(es)) {
    const list = [es, en, fr, de, it, pt, zh, ja, ko, ar, ru];
    const indexMap = { es: 0, en: 1, fr: 2, de: 3, it: 4, pt: 5, zh: 6, ja: 7, ko: 8, ar: 9, ru: 10 };
    const idx = indexMap[currentLang];
    return list[idx] || list[1] || list[0];
  }

  // If all 10 translations are explicitly passed as arguments:
  if (arguments.length > 2) {
    const indexMap = { es: 0, en: 1, fr: 2, de: 3, it: 4, pt: 5, zh: 6, ja: 7, ko: 8, ar: 9, ru: 10 };
    const idx = indexMap[currentLang];
    return arguments[idx] || en || es;
  }

  // Otherwise, use the global UI_WORDS lookup dictionary
  if (typeof es === 'string') {
    const match = window.UI_WORDS && window.UI_WORDS[es];
    if (match) {
      return match[currentLang] || match.en || match.es || en;
    }
  }
  
  return currentLang === 'es' ? es : en;
};

// Robust helper to physically swap block tags in contentEditable elements
window.changeBlockTag = function(editor, targetTag) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  
  // Find all direct children of the editor that intersect the selection
  const children = Array.from(editor.children);
  const selectedBlocks = children.filter(child => sel.containsNode(child, true));
  
  // Fallback for collapsed cursor selection (point target)
  if (selectedBlocks.length === 0) {
    let node = range.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    let current = node;
    while (current && current !== editor) {
      if (children.includes(current)) {
        selectedBlocks.push(current);
        break;
      }
      current = current.parentNode;
    }
  }
  
  if (selectedBlocks.length > 0) {
    let replacedAny = false;
    selectedBlocks.forEach(blockNode => {
      // Standard structural tags we are allowed to convert
      if (!['H1', 'H2', 'P', 'DIV', 'BLOCKQUOTE'].includes(blockNode.tagName)) return;
      
      const newBlock = document.createElement(targetTag);
      newBlock.innerHTML = blockNode.innerHTML;
      
      // Clean inline styling from external paste if converting back to plain paragraph
      if (targetTag.toLowerCase() === 'p') {
        newBlock.removeAttribute('style');
        newBlock.querySelectorAll('*').forEach(child => {
          child.removeAttribute('style');
        });
      }
      
      blockNode.parentNode.replaceChild(newBlock, blockNode);
      replacedAny = true;
    });
    return replacedAny;
  }
  return false;
};

// Web Audio API programmatical sound effects engine (ultra-low latency, zero external files)
window.playAudioTone = function(type) {
  if (window.isAudioMuted) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    // Los tonos escalan con el deslizador de volumen (antes solo se respetaba el
    // silencio y todo sonaba igual de bajo). Con el volumen por defecto (0.5) los
    // sonidos son ~1.6x más fuertes que antes; al máximo, ~3x.
    const k = (typeof window.audioVolume === 'number' ? window.audioVolume : 0.5) * 3.2;

    // Un tono simple: onda, frecuencia inicial/final, retardo, duración y ganancia base
    const tone = ({ wave = 'sine', from, to, at = 0, dur, gain: g }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = wave;
      osc.frequency.setValueAtTime(from, now + at);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, now + at + dur);
      gain.gain.setValueAtTime(Math.min(0.5, g * k), now + at);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.start(now + at);
      osc.stop(now + at + dur);
    };

    if (type === 'click') {
      // Premium mechanical high-frequency tick
      tone({ from: 880, to: 1500, dur: 0.015, gain: 0.02 });
    } else if (type === 'create') {
      // Satisfying organic bubble plop
      tone({ from: 180, to: 780, dur: 0.08, gain: 0.05 });
    } else if (type === 'drop') {
      // Soltar un nodo nuevo en el lienzo: plop + blip de confirmación
      tone({ from: 160, to: 620, dur: 0.09, gain: 0.055 });
      tone({ from: 880, to: 1180, at: 0.09, dur: 0.07, gain: 0.035 });
    } else if (type === 'delete') {
      // Soft tactile slip / paper slide
      tone({ from: 260, to: 60, dur: 0.12, gain: 0.04 });
    } else if (type === 'connect') {
      // Soft acoustic dual chime (music box)
      tone({ from: 523.25, dur: 0.16, gain: 0.03 });
      tone({ from: 783.99, at: 0.04, dur: 0.12, gain: 0.03 });
    } else if (type === 'drag_start') {
      // Soft card lift/grab thump
      tone({ from: 140, to: 90, dur: 0.03, gain: 0.03 });
    } else if (type === 'drag_end') {
      // Soft card landing drop
      tone({ from: 100, to: 50, dur: 0.05, gain: 0.04 });
    } else if (type === 'snap') {
      // Tiny haptic ticking sound
      tone({ from: 1200, dur: 0.008, gain: 0.008 });
    } else if (type === 'board_open') {
      // Entrar a un tablero: arpegio ascendente suave, al estilo de los canales de Wii
      tone({ wave: 'triangle', from: 523.25, dur: 0.35, gain: 0.030 }); // C5
      tone({ wave: 'triangle', from: 659.25, at: 0.07, dur: 0.32, gain: 0.032 }); // E5
      tone({ wave: 'triangle', from: 783.99, at: 0.14, dur: 0.30, gain: 0.034 }); // G5
      tone({ wave: 'sine',     from: 1046.5, at: 0.21, dur: 0.42, gain: 0.030 }); // C6
    }
  } catch (e) {
    // Fail silently if browser audio context blocked
  }
};
