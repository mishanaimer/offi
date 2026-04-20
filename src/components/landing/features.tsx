import { Brain, MessageSquare, FileText, Users, Workflow, Zap } from "lucide-react";

const FEATURES = [
  { icon: Brain, title: "Учится на ваших документах", text: "PDF, DOCX, Excel, CSV или URL сайта — всё превращается в базу знаний за минуты." },
  { icon: MessageSquare, title: "Общается как ChatGPT", text: "Но знает ваш бизнес: прайсы, регламенты, клиентов, историю сделок. С источниками в ответе." },
  { icon: Workflow, title: "Выполняет действия", text: "Письма, встречи в Телемосте, договоры из шаблонов, сообщения в Telegram — одной командой." },
  { icon: Users, title: "Командный чат", text: "Личные сообщения, групповые чаты и общие ветки с ассистентом. Для всей команды." },
  { icon: FileText, title: "Документы за 10 секунд", text: "Подставьте клиента и шаблон — получите договор или КП в один клик." },
  { icon: Zap, title: "Оплата рублями", text: "Без VPN. RouterAI + Supabase. Дёшево на масштабе: 0,56 ₽ за средний запрос." },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-20 md:py-28 border-t border-border">
      <div className="container-page">
        <div className="max-w-2xl">
          <div className="text-sm text-primary font-medium">Что умеет Offi</div>
          <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
            Ассистент, заточенный под бизнес
          </h2>
          <p className="mt-4 text-muted-foreground">
            Не ещё один чат-бот. Это агент, который разбирается в ваших документах и действует от вашего имени — с вашим подтверждением.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card-surface p-6 transition-shadow hover:shadow-[var(--shadow-md)]">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
