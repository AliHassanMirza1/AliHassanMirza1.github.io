// Single source of truth for every word on the site.
// Both the 3D city (panels, labels, minimap) and the classic/SEO view render from this file,
// so edit content here and nowhere else. `**text**` renders as bold.

export const profile = {
  name: 'Muhammad Ali Hassan',
  shortName: 'Ali Hassan',
  initials: 'MAH',
  role: 'AI Engineer',
  headline: 'AI Engineer · MS CS @ UIC · Fulbright Scholar',
  location: 'Chicago, IL',
  tagline: 'Building AI and software that scale further and cost less.',
  motto: 'Chicago by day. Gotham by night.',
  email: 'mhass56@uic.edu',
  avatar: '/img/ali-portrait.jpg',
  resume: '/docs/Ali-Hassan-Resume.pdf',
  cv: '/docs/Ali-Hassan-Academic-CV.pdf',
  site: 'https://alihassanmirza1.github.io',
  links: {
    linkedin: 'https://www.linkedin.com/in/alimirza99',
    github: 'https://github.com/AliHassanMirza1',
    leetcode: 'https://leetcode.com/u/AliHassanMirza/',
  },
};

const PAPER_URL = 'https://ieeexplore.ieee.org/document/11628051';

// Each stop is a landmark in the city and a section in the classic view, in tour order.
export const stops = [
  {
    id: 'hq',
    label: 'About Me',
    short: 'About Me',
    kicker: 'About Me · Headquarters',
    title: 'Muhammad Ali Hassan',
    color: '#e8edf5',
    lede:
      'AI engineer and Fulbright Scholar pursuing an MS in Computer Science at the University of Illinois Chicago. I build AI models and the software systems that carry them, designed to grow with their users and stay cheap enough to run anywhere, so they reach the people who need them most.',
    stats: [
      { v: '100+', l: 'concurrent users on one commodity server' },
      { v: '93%', l: 'less CPU inference time vs. baseline' },
      { v: '1/10', l: 'the cost of a conventional flood station' },
      { v: 'IEEE', l: 'OJ-CS journal paper, 2026' },
    ],
    blocks: [
      {
        type: 'story',
        heading: 'Why I build',
        paragraphs: [
          'In September 2014 I was thirteen, crouched behind sacks of flour stacked against our front door in Multan while the Chenab flooded. The water never reached our neighbourhood. It did reach the slums by the river, and that was the day I saw two parallel cities: one prepared, one left to fend for itself.',
          'That divide still shapes how I build. Technology only helps people if it can grow to reach them and stays cheap enough to keep running, so I care as much about the system as the model. At LUMS that meant a flood monitor built for a tenth of the usual cost, a five-camera wildfire network covering 300 km² of Northern Pakistan, and an LLM and blockchain platform that gives clinicians governed, auditable access to sensitive health data.',
          'At Tibbling Technologies I built a compact neuro-segmentation model and the platform that carries it, with fine-tuning in the browser and real-time 3D segmentation. Moving it from AWS to a single commodity server ended our recurring cloud bill while serving 100+ users at once. Labs at the University of Washington and in Zurich validated it, and the Broad Institute used it for analysis supporting autism drug discovery.',
          'Now in Chicago on a Fulbright, I’m going deeper into scalable AI and distributed systems, and I plan to take them home: affordable, local-language AI for healthcare and education in Pakistan.',
        ],
      },
      {
        type: 'note',
        heading: 'Off the clock',
        text: 'Gamer (God of War fan), traveller and tough-hike chaser, with rugby, swimming, the gym and, lately, basketball in the mix. A people person who loves going out and working for social causes. Next up: K2 base camp and Yellowstone National Park.',
      },
      {
        type: 'cta',
        links: [
          { label: 'Download résumé', href: profile.resume, icon: 'doc', primary: true },
          { label: 'Academic CV', href: profile.cv, icon: 'doc' },
          { label: 'Email me', href: `mailto:${profile.email}`, icon: 'mail' },
          { label: 'LinkedIn', href: profile.links.linkedin, icon: 'linkedin' },
          { label: 'GitHub', href: profile.links.github, icon: 'github' },
        ],
      },
    ],
  },
  {
    id: 'neuro',
    label: 'Tibbling Technologies',
    short: 'Tibbling (Work)',
    kicker: 'Experience · AI Engineer',
    title: 'Tibbling Technologies',
    color: '#8b6cff',
    lede: 'Neuroscience labs shouldn’t need a GPU cluster to segment their images. I built the models, and the platform around them, that make that possible.',
    stats: [
      { v: '93%', l: 'faster CPU inference, beating SAM on Dice' },
      { v: '36K+', l: 'neuro-preclinical images evaluated' },
      { v: '1 patch', l: 'to adapt to a new imaging domain' },
      { v: '100+', l: 'concurrent users on 100 GB+ volumes' },
    ],
    blocks: [
      {
        type: 'entry',
        title: 'AI Engineer',
        org: 'Tibbling Technologies · Neuro-AI startup',
        dates: 'Jan 2025 – Aug 2026',
        place: 'Remote · Seattle',
        meta: 'Advisor: Dr. Asim Iqbal (Weill Cornell Medicine)',
        bullets: [
          'Built a **200K-parameter 1D segmentation model** in PyTorch that cuts CPU inference time by **93%** while exceeding Meta’s SAM in Dice score across **36,000+** neuro-preclinical images. Manuscript in preparation for *Nature Methods*.',
          'Generalised it into a **universal neuro-segmenter** trained on self-supervised datasets of neurons and axons, with CPU-only few-shot fine-tuning (**DoRA / FiLM adapters**) that adapts to a new imaging domain from **one annotated patch**.',
          'Shipped a full-stack **Next.js** app for in-browser fine-tuning and real-time 3D segmentation, validated by labs at the **University of Washington** and **Zurich**. The **Broad Institute** used it for colocalisation analysis supporting autism drug discovery.',
          'Migrated the Dockerised stack from AWS to a **single commodity server** by moving storage to **OME-Zarr** and inference to **ONNX Runtime**. That eliminated recurring cloud costs while scaling to **100+ concurrent users** on 100 GB+ 3D medical volumes.',
        ],
        tags: ['PyTorch', 'ONNX Runtime', 'OME-Zarr', 'Next.js', 'Docker', 'AWS', 'DoRA / FiLM', 'Self-supervised learning'],
      },
    ],
  },
  {
    id: 'ccrl',
    label: 'Healthcare AI Research',
    short: 'Research Lab',
    kicker: 'Research · Cloud Computing Research Lab, LUMS',
    title: 'Governed AI for Healthcare',
    color: '#22d3ee',
    lede: 'Hospitals want to share data; regulators need proof it was shared correctly. We built infrastructure that gives clinicians natural-language analytics, with an audit trail no one can rewrite.',
    stats: [
      { v: '17', l: 'workflow types generated near-perfectly' },
      { v: '400K+', l: 'patient records in survival analyses' },
      { v: 'On-chain', l: 'immutable audit trail' },
      { v: '2026', l: 'published in IEEE OJ-CS' },
    ],
    blocks: [
      {
        type: 'entry',
        title: 'Research Assistant',
        org: 'Cloud Computing Research Lab, LUMS',
        dates: 'Jun 2024 – May 2025',
        place: 'Lahore, Pakistan',
        meta: 'Advisors: Dr. Basit Shafiq (LUMS) · Dr. Jaideep Vaidya (Rutgers)',
        bullets: [
          'Designed an **LLM pipeline that turns natural language into BPMN workflows** for survival analysis (Cox models, Kaplan–Meier curves), giving clinicians governed analytics through a MERN app. Structured prompting yielded **near-perfect executable workflows across 17 types**.',
          'Built a **blockchain access-control system** (Solidity, Ethereum / Sepolia) that authorises dataset requests against **XACML policies** and logs an **immutable audit trail on-chain**, keeping patient data off-chain.',
          'Ran an ablation across four prompt settings on SEER and German Cancer Registry data (**400,000+ patients**), mapping the trade-offs between prompt richness, workflow detail and latency.',
        ],
        tags: ['LLMs', 'Prompt engineering', 'BPMN', 'Solidity', 'Ethereum', 'XACML', 'MERN', 'Survival analysis'],
        links: [{ label: 'Read the IEEE OJ-CS paper', href: PAPER_URL }],
      },
    ],
  },
  {
    id: 'field',
    label: 'Wildfire & Flood AI',
    short: 'Field Research',
    kicker: 'Field research · Edge AI for disaster response',
    title: 'Wildfire & Flood Monitoring',
    color: '#ff7a3d',
    lede: 'Conventional monitoring stations cost too much for the remote valleys that need them most. These two systems watch for wildfire and flood across Northern Pakistan on a shoestring budget.',
    stats: [
      { v: '300 km²', l: 'of forest covered with WWF' },
      { v: '5', l: 'autonomous PTZ cameras' },
      { v: '99%', l: 'hotspot localisation accuracy' },
      { v: '1/10', l: 'the cost of a conventional station' },
    ],
    blocks: [
      {
        type: 'entry',
        title: 'Wildfire watch network',
        org: 'IoT Lab, LUMS · with WWF',
        role: 'Research Apprentice',
        dates: 'Sep 2024 – Jan 2025',
        place: 'Lahore, Pakistan',
        meta: 'Advisor: Dr. Murtaza Taj',
        bullets: [
          'Shipped a **5-camera PTZ network with WWF** covering **300 km²** of Northern Pakistan to catch forest fires early.',
          'Automated pan / tilt / zoom sweeps through the **Hikvision API** with overlap-aware capture planning, so every ridge gets inspected.',
          '**Python / OpenCV + YOLO** inference localises hotspots at **99% accuracy** and raises early alerts for the authorities.',
        ],
        tags: ['Python', 'OpenCV', 'YOLO', 'Hikvision API', 'PTZ control'],
      },
      {
        type: 'entry',
        title: 'AIoT flood & wildlife monitor',
        org: 'Centre for Water Informatics & Technology, LUMS',
        role: 'Research Intern',
        dates: 'Jun 2024 – Aug 2024',
        place: 'Lahore, Pakistan',
        meta: 'Advisor: Dr. Talha Manzoor',
        bullets: [
          'Architected an **ESP32-CAM monitor** for floods and wildlife where conventional stations are too expensive to deploy.',
          'Screens frames **on-device with Edge Impulse** before a **GSM upload** to server-side **YOLOv5**, delivering monitoring at **1/10th the cost**.',
          'Used sleep modes and watchdog timers for reliable, power-efficient operation in internet-limited regions.',
        ],
        tags: ['ESP32-CAM', 'Edge Impulse', 'TinyML', 'YOLOv5', 'GSM'],
      },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    short: 'Projects',
    kicker: 'Projects · The Garage',
    title: 'Projects',
    color: '#34d399',
    lede: 'Things I’ve built because I wanted to understand them: consensus protocols, on-device LLMs and real-time platforms.',
    blocks: [
      {
        type: 'entry',
        title: 'Raft-based fault-tolerant key-value store',
        org: 'Go · RPC · Raft',
        bullets: [
          'Implemented the **Raft consensus protocol from scratch**: leader election, log replication and crash-recovery persistence.',
          'Validated against a test suite that simulates **network partitions, dropped RPCs and node restarts**.',
        ],
        tags: ['Go', 'Distributed systems', 'Consensus'],
      },
      {
        type: 'entry',
        title: 'On-device LLM profiling',
        org: 'Python · Ollama · ADB · Android',
        meta: 'Advisors: Dr. Ihsan Ayyub Qazi · Dr. Zafar Ayyub Qazi',
        bullets: [
          'Built a memory-tracing pipeline with Ollama and ADB to profile a **2-bit quantised Llama 3.2 1B** across **low-cost Android devices**.',
          'Identified **KV-cache growth** and **cold-start latency** as the primary bottlenecks limiting on-device inference.',
        ],
        tags: ['LLMs', 'Quantisation', 'Android', 'Profiling'],
        links: [{ label: 'GitHub', href: 'https://github.com/AliHassanMirza1/Deploying_LLMs_On_LowEnd_Android_Devices' }],
      },
      {
        type: 'entry',
        title: 'Full-stack hiring platform',
        org: 'React · Node.js · Express · MongoDB · Socket.io',
        bullets: [
          'Built **asynchronous video interviews**, real-time recruiter–candidate chat and application tracking from posting through offer.',
        ],
        tags: ['MERN', 'WebSockets', 'Video'],
        links: [
          { label: 'Live demo', href: 'https://recruitment-and-onboarding.vercel.app' },
          { label: 'GitHub', href: 'https://github.com/AliHassanMirza1/Recruitment-and-Onboarding' },
        ],
      },
      {
        type: 'list',
        heading: 'More from the garage',
        items: [
          { title: 'Distributed hash table', meta: 'Python · sockets', desc: 'Peer-to-peer DHT with fault tolerance for reliable retrieval in decentralised networks.' },
          { title: 'RAG research chatbot', meta: 'LangChain · Pinecone · FAISS', desc: 'Answers questions by retrieving from a corpus of research papers and Wikipedia.' },
          { title: 'Real-time trading app', meta: 'MERN · Socket.io', desc: 'Instant offer updates and inventory sync for an online marketplace.', href: 'https://github.com/AliHassanMirza1/TradingApplication' },
          { title: 'Cloud billing system', meta: 'FastAPI · Nginx · SQL · Oracle Cloud', desc: 'Three-tier billing web app for bill retrieval, payments and adjustments.' },
          { title: 'UNIX-style shell', meta: 'C', desc: 'Command-line shell with pipelines and command chaining.' },
          { title: 'Battery-less IoT security', meta: 'Research · Mementos', desc: 'Showed that charge/discharge cycles leak which app an intermittent device is running.' },
        ],
      },
    ],
  },
  {
    id: 'records',
    label: 'Publications & Awards',
    short: 'Publications',
    kicker: 'Publications & awards · Hall of Records',
    title: 'Publications & Awards',
    color: '#ff3b5c',
    lede: 'Peer-reviewed work, and the people who bet on me.',
    blocks: [
      {
        type: 'pub',
        heading: 'Publications',
        items: [
          {
            authors: 'S. Ali, **M. A. Hassan**, H. Ahmad, A. Jai, B. Shafiq, et al.',
            title: 'Governance-Aware AI Workflow Infrastructure for Secure and Policy-Compliant Healthcare Analytics',
            venue: 'IEEE Open Journal of the Computer Society, vol. 7, pp. 1377–1388, 2026',
            href: PAPER_URL,
          },
          {
            authors: '**M. A. Hassan** et al.',
            title: 'CPU-efficient neuro-segmentation (Tibbling Technologies)',
            venue: 'Manuscript in preparation for Nature Methods',
          },
        ],
      },
      {
        type: 'list',
        heading: 'Awards & honours',
        items: [
          { title: 'Fulbright Master’s Scholarship', meta: '2026' },
          { title: 'Winner, Techstars Startup Weekend Lahore', meta: '2025', desc: 'Most innovative startup, for low-resource-language AI.' },
          { title: 'Winner, Ideation Academy startup incubator', meta: '2023' },
          { title: 'Winner, Future Synergy AI-powered Innovation Challenge', meta: 'Incubation placement, Azerbaijan' },
          { title: 'Dean’s Honor List, LUMS', meta: '2021–22' },
          { title: 'Merit Scholarship, LUMS', meta: '2021–22' },
          { title: '100% Merit Scholarship, A Levels', meta: 'Bloomfield Hall School' },
          { title: 'NVIDIA DLI: Fundamentals of Accelerated Data Science', meta: 'Certification' },
        ],
      },
    ],
  },
  {
    id: 'academy',
    label: 'Education',
    short: 'Education',
    kicker: 'Education & teaching · The Academy',
    title: 'Education',
    color: '#5aa9ff',
    lede: 'From Lahore to Chicago, and a lot of office hours in between.',
    blocks: [
      {
        type: 'entry',
        title: 'MS, Computer Science',
        org: 'University of Illinois Chicago',
        dates: 'Sep 2026 – Jun 2028',
        place: 'Chicago, IL',
        meta: 'Fulbright Scholar',
      },
      {
        type: 'entry',
        title: 'BS, Computer Science',
        org: 'Lahore University of Management Sciences (LUMS)',
        dates: 'Sep 2021 – May 2025',
        place: 'Lahore, Pakistan',
        meta: 'Dean’s Honor List · Merit Scholarship',
        bullets: [
          'Coursework: Data Structures, Algorithms, Operating Systems, Distributed Systems, Databases, Blockchain, Deep Learning, Machine Learning, Network Security, Topics in LLMs, Internet of Things.',
          'Summer exchange at the University of Baltistan (2023).',
        ],
      },
      {
        type: 'list',
        heading: 'Teaching',
        items: [
          { title: 'Head TA, CS 100: Computational Problem Solving', meta: 'Summer & Fall 2022', desc: 'Led a team of 4 TAs supporting 200+ students; mentored C++ labs across 6 project groups.' },
          { title: 'TA, CS/EE 3812: Blockchain Technology & Applications', meta: 'Spring 2023', desc: 'Ran tutorials on Solidity and contract deployment for 40 grad and undergrad students; wrote assignments, quizzes and exams.' },
          { title: 'TA, CS 210: Discrete Mathematics', meta: 'Fall 2023', desc: 'Office hours and assignment support on logic, combinatorics, graphs and proofs for 200+ students.' },
        ],
      },
      {
        type: 'note',
        heading: 'Before LUMS',
        text: 'Bloomfield Hall School, Cambridge A Levels: A* in Mathematics, Physics and Chemistry on a 100% merit scholarship.',
      },
    ],
  },
  {
    id: 'arena',
    label: 'Leadership',
    short: 'Leadership',
    kicker: 'Leadership & community · The Arena',
    title: 'Leadership',
    color: '#ff5fa2',
    lede: 'Teams I’ve started, led or grown, from speech technology for under-served languages to a 1,000-person esports scene.',
    stats: [
      { v: '10+ hrs', l: 'of Pashto speech collected' },
      { v: '1,000+', l: 'esports event attendees' },
      { v: '50+', l: 'member team led' },
      { v: 'PKR 200K', l: 'in sponsorships raised' },
    ],
    blocks: [
      {
        type: 'entry',
        title: 'CEO & Co-Founder',
        org: 'Project Indigenous',
        dates: 'Jan 2025 – present',
        bullets: [
          'Tackling Pakistan’s speech-tech gap with **ASR / TTS** for under-served languages. We collected **10+ hours of Pashto speech** and won startup incubation.',
          'Pitched at **Techstars Startup Weekend Lahore** and won most innovative startup.',
        ],
        tags: ['ASR', 'TTS', 'Low-resource NLP'],
      },
      {
        type: 'entry',
        title: 'Co-Founder & General Secretary',
        org: 'E-Gaming at LUMS',
        dates: 'May 2023 – Jun 2024',
        bullets: ['Led a **50+ member team** running high-profile esports events with **1,000+ attendees** and **PKR 200K** in sponsorships.'],
      },
      {
        type: 'list',
        heading: 'Also',
        items: [
          { title: 'Committee Director, LUMS Model United Nations', meta: '2023–24', desc: 'Directed a 50-member team across 20+ academic sessions.' },
          { title: 'Director Media, SPADES & DANCELUMS', meta: '2021–23', desc: 'Led media teams of 10+ reaching an audience of 50,000+.' },
          { title: 'Peer Ambassador for Social Support, LUMS', meta: '2023–24', desc: 'Mentored first-year students through academic and personal transitions.' },
        ],
      },
    ],
  },
  {
    id: 'armory',
    label: 'Skills',
    short: 'Skills',
    kicker: 'Skills & toolkit · The Armory',
    title: 'Skills',
    color: '#b7f34a',
    lede: 'The utility belt: the tools I reach for, from training models to shipping them to a microcontroller.',
    blocks: [
      {
        type: 'chips',
        groups: [
          { label: 'Languages', items: ['Python', 'C++', 'C', 'Go', 'TypeScript', 'JavaScript', 'Solidity', 'SQL', 'Haskell'] },
          { label: 'ML & AI', items: ['PyTorch', 'ONNX Runtime', 'LangChain', 'YOLO', 'OpenCV', 'NumPy', 'scikit-learn', 'Hugging Face', 'DoRA / LoRA', 'RAG · FAISS · Pinecone'] },
          { label: 'Systems & infra', items: ['Docker', 'AWS', 'Linux', 'Git', 'Raft / consensus', 'OME-Zarr', 'Nginx', 'Oracle Cloud'] },
          { label: 'Web', items: ['React', 'Next.js', 'Node.js', 'Express', 'MongoDB', 'FastAPI', 'REST', 'Socket.io'] },
          { label: 'Edge & IoT', items: ['ESP32', 'Edge Impulse', 'Hikvision API', 'Arduino', 'GSM'] },
          { label: 'Blockchain', items: ['Solidity', 'Ethereum', 'XACML', 'Infura', 'MetaMask'] },
          { label: 'Science tools', items: ['Napari', 'Fiji'] },
        ],
      },
    ],
  },
  {
    id: 'signal',
    label: 'Contact Me',
    short: 'Contact Me',
    kicker: 'Contact Me · The Signal',
    title: 'Contact Me',
    color: '#ffd23f',
    lede: 'I’m open to research collaborations, internships and conversations about efficient, impact-driven AI. Email is the fastest way to reach me.',
    blocks: [
      {
        type: 'contact',
        items: [
          { label: 'Email', value: profile.email, href: `mailto:${profile.email}`, icon: 'mail' },
          { label: 'LinkedIn', value: 'in/alimirza99', href: profile.links.linkedin, icon: 'linkedin' },
          { label: 'GitHub', value: 'AliHassanMirza1', href: profile.links.github, icon: 'github' },
          { label: 'LeetCode', value: 'AliHassanMirza', href: profile.links.leetcode, icon: 'code' },
        ],
      },
      {
        type: 'cta',
        links: [
          { label: 'Send the signal', href: `mailto:${profile.email}?subject=Hello%20from%20your%20portfolio`, icon: 'mail', primary: true },
          { label: 'Résumé (PDF)', href: profile.resume, icon: 'doc' },
          { label: 'Academic CV (PDF)', href: profile.cv, icon: 'doc' },
        ],
      },
    ],
  },
];

export const stopById = Object.fromEntries(stops.map((s) => [s.id, s]));
