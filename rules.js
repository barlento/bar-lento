// Bar Lento — House Rules (employee code of conduct).
// Staff read and acknowledge this once per version, right after their first PIN login.
// To publish a new version: change `version` (YYYY-MM-DD) → everyone is asked to read and acknowledge again.
// `version: null` keeps the rules dormant (nothing is shown to staff).
// Text fixes that do not change the substance (typos, an email address) can be made without changing the version:
// the server stores a fingerprint of the exact text each person acknowledged.
(function (root) {
var RULES = {
  version: "2026-09-18",
  title: "Bar Lento — House Rules",
  subtitle: "Employee Code of Conduct · 158 8th Avenue, New York, NY",
  contacts: [
    {"name":"Simone Viola (Owner)","email":"simone.viola@barlentony.com"},
    {"name":"Chiara Tinazzi (Owner)","email":"chiara.tinazzi@barlentony.com"},
    {"name":"Marta Nicita (Manager)","email":"marta.nicita@barlentony.com"}
  ],
  intro: "Welcome to the Bar Lento team. These House Rules explain how we work together so that guests, colleagues and the business are treated with respect. They apply to every team member. In these rules, \"the manager\" means the floor manager and \"the owners\" means the two owners, all listed in the contacts at the end; \"a manager\" means any one of them. Reading these rules is working time: if you read them outside a shift, tell the manager and the time is added to your paid hours. They are not an employment contract and do not change the at-will nature of your employment: you or Bar Lento may end the employment relationship at any time, with or without cause or notice, as permitted by law. Bar Lento may update these rules. When it does, you will be asked to read and acknowledge the new version. You can read or print these rules at any time from My week in the app, and if anything is unclear — or you would prefer it explained in Italian — ask an owner or the manager before you confirm. If anything here conflicts with New York State, New York City or federal law, the law prevails.",
  sections: [
    { h: "1. Punctuality and attendance", items: [
      "Be ready to start working at your scheduled start time. Clock in on the Toast POS the moment you start working and clock out the moment you stop — every minute you work is paid. Do not start before your scheduled time or stay after your shift unless a manager asks you to.",
      "Never work off the clock, not even a minute: no setting up, closing, cleaning or answering work messages before you clock in or after you clock out. If it ever happens by mistake, or if you forget to clock in or out, tell the manager the same day so the time is added to your paid hours.",
      "Clock in and out only on the Toast POS terminal, with your own account. Never clock in or out for someone else, and never ask anyone to do it for you.",
      "When a new week is posted in the schedule app, open it and confirm your own shifts (tap the shift, then Confirm). Confirming a shift is not a clock-in: you still clock in on Toast when you arrive.",
      "If you are running late or cannot come to work, tell us as early as possible: email all the contacts listed at the end and, if your shift starts within a few hours, also call or text the owner or manager on duty at the work phone number you received when you started and that is posted in the staff area (see section 17).",
      "You may use safe and sick leave as provided by New York State and New York City law: for your own illness, injury or medical care, to care for a family member, for \"safe time\" needs (for example domestic violence), and for the paid prenatal care leave New York law provides. Let us know as soon as you reasonably can, following section 17; if the appointment is planned, tell us in advance. We will never ask you what your illness is, ask you to find your own replacement, or ask you to make up the hours, and using this leave is never counted as an attendance problem. The details (how much leave you earn, when it is paid, and your balance) are in the written Safe and Sick Time policy and in the NYC Notice of Employee Rights, which you receive in English or Italian — ask an owner or the manager if you have not received them.",
      "Food safety (NYC Health Code): if you have vomiting, diarrhea, jaundice, a sore throat with fever, or an infected cut on your hands or arms, or if a doctor has diagnosed you with norovirus, hepatitis A, Salmonella, Shigella or E. coli, tell a manager before your shift and stay off food and drink preparation until you are better. Just name the symptom — no other details are needed. Your paid sick leave applies, and nobody is penalized for reporting."
    ]},
    { h: "2. Respect and teamwork", items: [
      "Treat guests, colleagues and management with courtesy. This is about how we behave on the floor and toward guests; it does not limit honest conversations among coworkers about work.",
      "Never argue or discuss a disagreement in front of guests. Step away from the floor, stay calm, and sort it out later — you are welcome to bring it to a manager if you'd like help.",
      "Bar Lento does not tolerate harassment, discrimination, bullying, violence or threats of any kind.",
      "Bar Lento's Sexual Harassment Prevention Policy (New York Labor Law §201-g) applies to everyone. You receive the policy and its complaint form in English or Italian — ask an owner or the manager if you have not received them — and you complete the required anti-harassment training every year on paid time.",
      "You can report any concern to any of the contacts listed at the end, in writing or in person. Reports are kept as confidential as possible. Retaliation against anyone who reports in good faith is prohibited. Besides talking to us, you always have the right to contact the New York State Division of Human Rights, the New York City Commission on Human Rights, the U.S. EEOC or the police."
    ]},
    { h: "3. Uniform and appearance", items: [
      "Bar Lento provides your uniform shirts free of charge. They are wash-and-wear: machine wash and dry with your normal laundry, no ironing, no dry cleaning, no special care. You receive at least two shirts, and in any case one for every day you normally work each week, so you always have a clean one for each shift. If your schedule grows, the manager gives you more shirts — it is Bar Lento's duty to provide enough, not yours to ask.",
      "Wear a clean uniform shirt in good condition at every shift. If a shirt is damaged, worn out or lost, tell the manager and it is replaced free of charge. Bar Lento never deducts the cost of uniforms from your pay and never charges you for a lost or damaged shirt.",
      "The uniform shirt is a normal shirt: you can wear it from home. Changing on site is your choice, not a requirement.",
      "Come to work clean and tidy: clean uniform shirt, clean closed shoes of your choice, hands and nails clean. When you prepare or serve food or drinks, hair must be tied back or restrained (hair tie, cap, headband), as the NYC Health Code requires. All hair textures and hairstyles are welcome, our appearance rules are the same for everyone regardless of gender, and religious dress or grooming (head coverings, beards and so on) is respected. If any rule here conflicts with your religion, your culture or a medical need, tell us (see section 15) and we will adjust it."
    ]},
    { h: "4. Personal phones", items: [
      "Use your personal phone only during breaks, away from the floor and the bar. Exceptions: a manager asks you to use it for work, or there is an emergency.",
      "During your shift keep your phone on silent, in your locker or in your pocket."
    ]},
    { h: "5. Smoking and vaping", items: [
      "Smoking and vaping are prohibited inside the bar and in the outdoor seating area — that is the law (New York Clean Indoor Air Act and NYC Smoke-Free Air Act, which include e-cigarettes). As Bar Lento's own rule, they are also prohibited in the garden and backyard and at the entrance.",
      "If you smoke, do it only during your break, off the premises and not in front of the entrance or the outdoor seating."
    ]},
    { h: "6. Alcohol, cannabis and drugs", items: [
      "Do not drink alcohol during your shift. The only exception is a tasting expressly authorized by a manager for training or quality control.",
      "Do not report to work, or remain at work, while impaired by alcohol, cannabis or any other drug. \"Impaired\" means specific, observable signs while you are working — for example unsteadiness, slurred speech, or being unable to do your job safely — never just a smell or a suspicion. If a manager observes such signs you will be sent home for the rest of the shift and we will talk the next day. Do not use, possess, share or sell alcohol (other than serving it as part of your job), cannabis or illegal drugs on the premises or during working time.",
      "Consistent with New York Labor Law §201-d, what you legally do on your own time, away from work, is your business. What matters here is that you are fit, safe and professional while at work.",
      "Legally prescribed medication is fine, and you never have to tell us what you take. If you think a medication could affect your ability to work safely, we encourage you to tell a manager so we can adjust your tasks; anything you share is kept confidential and used only for that purpose. Certified medical-cannabis patients are protected by New York law; the rule about not being impaired at work applies to everyone."
    ]},
    { h: "7. Restrooms, changing area and lockers", items: [
      "Restrooms are shared with guests. Leave them clean, report any problem right away, and never use them as a break area.",
      "Keep the changing area and your locker clean and tidy. Personal items belong in your locker, not on shelves, counters or the floor.",
      "Lockers are Bar Lento property made available for your use. Bar Lento is not responsible for lost, damaged or stolen personal items. For safety or hygiene reasons a locker may be opened by an owner or the manager, with notice to you where reasonably possible.",
      "There are no cameras in restrooms or in the changing area (see section 12)."
    ]},
    { h: "8. Security: doors and keys", items: [
      "The office door and the wine room door must always be closed and locked.",
      "If you find either of them open, close it and immediately tell an owner or the manager, in person and by email.",
      "Keys, codes and passwords are personal. Never share them or leave them unattended."
    ]},
    { h: "9. Closing the bar", items: [
      "Closing is done by an owner or the manager. On days when no owner or manager is present, an owner or the manager assigns the closing to a team member on shift who is at least 18 years old, and tells them before the shift starts. The manager walks you through the closing checklist before your first closing.",
      "Whoever closes follows the closing checklist: check that no guest is left inside; turn off gas, cooking equipment and appliances that are not meant to stay on; check that fridge and freezer doors are closed; take the trash out; close the day on the Toast POS; lock the office door and the wine room door; turn off the lights; then clock out on Toast and lock every entrance. All closing work is paid time: clock out only when everything is done. If anything cannot be completed or looks wrong, message the owners and the manager before leaving.",
      "No staff drinks after closing: once service ends, the bar is closed for everyone.",
      "Your safety comes first. After closing, do not open the door to anyone, even someone you know. If anyone tries to force entry or you feel unsafe, do not resist and do not confront them: get to a safe place, call 911, then call or text the owners and the manager (the work phone number is in the staff area, see section 17). Send a short text to the manager when the bar is locked and you have left.",
      "Never leave the bar unattended while it is open. Keys are given only to the person assigned to close, and only for that shift: never lend them or hand them to anyone else, including colleagues, and return them as agreed. If a key is lost or stolen, tell an owner or the manager the same day."
    ]},
    { h: "10. Honesty and theft", items: [
      "Taking anything that is not yours — cash, tips, food, drinks, stock or any other property of Bar Lento, of a guest or of a colleague — is theft.",
      "Theft, fraud or deliberate damage is a serious matter. Bar Lento will review what happened (including camera footage) and may end employment immediately, report the matter to the police and recover its loss through the courts. Bar Lento never deducts anything from your pay or tips for shortages, breakage, mistakes or losses — New York Labor Law §193 does not allow it. Accidental breakage or an honest mistake is not theft: just tell the manager right away.",
      "Complimentary items, discounts and voids are given only with a manager's authorization and are recorded in the POS."
    ]},
    { h: "11. Payments, cash and tips", items: [
      "Bar Lento is a card-first bar: we do not keep a register at the bar and you never hold cash belonging to the business. New York City law says a guest paying in person for food or drinks may not be refused cash and may not be charged more for paying cash. So if a guest wants to pay in cash, never say \"we don't take cash\": say \"let me get the manager for you\" and call the owner or manager on duty, who handles the cash payment (or shows the guest the cash-to-card machine, if Bar Lento has one) and makes sure the sale is recorded in Toast.",
      "Tips belong to the team members who earn them and are protected by New York Labor Law §196-d: owners and the manager never take any share of tips. Card tips are recorded in Toast and paid to you with your regular pay. If tips are shared among the team, the rules for sharing are given to you in writing before they apply, and you can ask the manager for a copy at any time.",
      "If a guest wants to leave a cash tip, tell the manager before accepting it, so that it is recorded correctly: cash tips must be reported for tax purposes and, where tips are shared, added to that shift's share. The manager never keeps it. Never keep undeclared cash."
    ]},
    { h: "12. Video surveillance and electronic monitoring notice", items: [
      "For the safety of everyone and to prevent loss, Bar Lento uses video cameras that record 24 hours a day in the bar, dining and service areas, storage areas, the office, the wine room, the backyard and the entrances. There are no cameras in restrooms or in the changing area, as required by New York Labor Law §203-c.",
      "Recordings may be reviewed by the owners and the manager and may be shared with law enforcement.",
      "This section is also Bar Lento's written notice under New York Civil Rights Law §52-c. Any and all telephone conversations or transmissions, electronic mail or transmissions, or internet access or usage made through Bar Lento's electronic devices, systems or accounts — including the Toast POS terminal, the schedule app and any Bar Lento email account you are given — may be subject to monitoring at any and all times and by any lawful means. Bar Lento does not monitor your personal phone or your personal accounts. Your electronic acknowledgment of these rules is your acknowledgment of this notice."
    ]},
    { h: "13. Staff meal and breaks", items: [
      "Every team member receives one free, simple staff meal per shift (for example plain pasta or the simple dish of the day). Eat it during your break, off the floor.",
      "Every shift of more than six hours includes an uninterrupted, unpaid meal break as required by New York Labor Law §162 (at least 30 minutes), scheduled by the manager. If you are asked to work during your break, that time is paid.",
      "The staff meal is a gift from Bar Lento: it is never counted as part of your wages."
    ]},
    { h: "14. Accidents and injuries at work", items: [
      "If you get hurt at work, even if it seems minor, or if you see an accident or a dangerous situation (a spill, broken glass, a loose step), tell the manager on duty right away and before leaving your shift. If no owner or manager is present, call or text the manager at the work phone number posted in the staff area (see section 17). Then, as soon as you can, send a short email to the contacts listed at the end saying what happened, when and where, so there is a dated record. Get first aid or medical care first, and call 911 in an emergency.",
      "Work-related injuries are covered by New York workers' compensation insurance, as required by law, no matter who was at fault. Medical treatment for a work injury is paid by the insurance carrier, not by you: tell the doctor or hospital that it is a work injury and give them the name of Bar Lento's insurance carrier, which is on the workers' compensation notice posted in the staff area. Reporting right away lets Bar Lento file the report the law requires within its deadlines.",
      "Nobody is ever penalized, disciplined or treated differently for reporting an injury or a safety problem, for filing a workers' compensation claim, or for taking part in a workers' compensation case. You may also file your own claim with the New York State Workers' Compensation Board; the manager will give you the information you need."
    ]},
    { h: "15. Health, allergies and accommodations", items: [
      "If you have an allergy, a medical condition, a disability, a pregnancy- or childbirth-related need, or a religious practice we should know about, or if you need any change at work (an accommodation), tell an owner or the manager in whatever way is easiest for you — email, message or in person. Apart from the food-safety symptoms listed in section 1, sharing this is voluntary. Everything you share is kept confidential and separate from your other records.",
      "As New York City law requires, we will talk it through with you (a \"cooperative dialogue\"), provide reasonable accommodations, and confirm the outcome to you in writing.",
      "If you are breastfeeding, New York law gives you paid 30-minute breaks to express milk each time you need them, for up to three years after birth, and a private, clean space that is not a bathroom. Bar Lento's written lactation policy is given to you when you are hired and every year — ask an owner or the manager if you have not received it."
    ]},
    { h: "16. Guests' privacy and confidential information", items: [
      "Guests trust us with their privacy. Never share information about guests with anyone outside the team: who was here, who they were with, what they ordered or said, where they sat.",
      "Never write down, photograph or copy a guest's card details or personal data.",
      "Do not photograph, film or record guests, and never post photos, videos or identifying details of guests on social media or messaging apps. Photos of the venue, of the food or of the team are welcome as long as no guest is recognizable and no guest's card or personal data is visible; if in doubt, ask a manager. You are always free to talk about your own job, pay and working conditions, online and offline. You do not need permission to post about Bar Lento; if you do, make clear that you are speaking for yourself, not as Bar Lento's official voice.",
      "Recipes, supplier names and costs, sales figures and internal documents are confidential business information: keep them inside the team. This is about guests and the business, never about your own pay or working conditions, which you are always free to discuss (see section 18)."
    ]},
    { h: "17. How to communicate with us", items: [
      "For anything work-related — absences, lateness, questions, problems, urgent matters and anything you want on record — send one email to all the contacts listed at the end. When the matter is urgent, also speak to the owner or manager on duty. (For sick and safe leave, section 1 applies.)",
      "The work phone number for urgent matters (lateness, absence, emergencies) is given to you when you start and is posted in the staff area. It is not published here. Use the phone for what is urgent and email for everything you want on record.",
      "If your phone number, email or address changes, email the contacts listed at the end so we can update our records."
    ]},
    { h: "18. Your rights", items: [
      "Nothing in these rules limits your rights under the law, including your right to discuss wages and working conditions with your coworkers, to take leave you are entitled to, and to report what you believe is a violation of the law to Bar Lento or to a public authority.",
      "Bar Lento does not retaliate against anyone for exercising these rights or for reporting a concern in good faith."
    ]}
  ],
  ack: "I confirm that I have received and read the Bar Lento House Rules, that I had the chance to ask questions, and that I understand them. I know I can read and print them at any time. I understand they are not an employment contract and that my employment remains at-will. I understand this also serves as my acknowledgment of Bar Lento's video surveillance notice and of its electronic monitoring notice under New York Civil Rights Law §52-c."
};
if (typeof module !== "undefined" && module.exports) module.exports = RULES; else root.BL_RULES = RULES;
})(typeof window !== "undefined" ? window : this);
