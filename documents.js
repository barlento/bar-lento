// Bar Lento — staff documents besides the House Rules: legal policies each person reads and acknowledges in the app
// (Documents), like the House Rules. Dual-mode: `window.BL_DOCS` in the browser, `require()` on the server.
// Each document has its own `version` (YYYY-MM-DD; the annual training uses the calendar year "YYYY"): change it and everyone
// is asked to read and acknowledge that document again. Text fixes that do not change the substance may keep the version
// (the server stores a fingerprint of the exact text each person acknowledged).
// Sources: NYS model Sexual Harassment Prevention Policy (2024 PDF, adopted in full) and model complaint form; NYS model training;
// NYC DCWP Protected Time Off law + FAQ (updated 02/22/2026) and Notice of Employee Rights; NYS DOL model policy on expressing
// breast milk in the workplace (2024 revision). Edit the text here directly.
// Block format: a section's `blocks` is a list of paragraphs (strings) and lists (arrays of strings or {t, sub:[...]}).
(function (root) {
var DOCS = {
  "copyTo": "simoneviola@barlentony.com",
  "contacts": [
    {
      "name": "Simone Viola (Owner)",
      "email": "simoneviola@barlentony.com"
    },
    {
      "name": "Chiara Tinazzi (Owner)",
      "email": "chiaratinazzi@barlentony.com"
    },
    {
      "name": "Marta Nicita (Manager)",
      "email": "martanicita@barlentony.com"
    }
  ],
  "deadlineDays": 7,
  "trainingDays": 30,
  "list": [
    {
      "id": "harassment",
      "version": "2026-09-18",
      "kind": "policy",
      "title": "Sexual Harassment Prevention Policy",
      "short": "Harassment policy",
      "subtitle": "New York State model policy (Labor Law §201-g, 2024 revision), adopted in full by Bar Lento · 158 8th Avenue, New York, NY",
      "intro": "This is Bar Lento’s Sexual Harassment Prevention Policy. It is the official New York State model policy, adopted in full and without omissions, with Bar Lento’s contacts filled in and a short summary at the top of how to report at Bar Lento. It applies to everyone who works at Bar Lento, to applicants and interns, and to anyone providing services in our workplace. Reading it is paid working time. If anything is unclear, or you would prefer it explained in Italian, ask an Owner before you confirm.",
      "sections": [
        {
          "h": "How to report at Bar Lento (summary)",
          "blocks": [
            "Tell someone in management you trust: the Manager (Marta Nicita) or one of the Owners (Simone Viola or Chiara Tinazzi). You can do it in person, by email, by text or call to the work phone number posted in the staff area, or with the complaint form at the end of this policy. If your complaint concerns the Manager, go to an Owner; if it concerns an Owner, go to the other Owner, or directly to the government agencies listed under Legal Protections. Every path is equally valid.",
            "Harassment by a guest counts too. If a guest harasses you, tell the Manager or Owner on duty right away: we step in, and you are never asked to keep serving someone who harasses you.",
            "Every report is looked into promptly, fairly and as confidentially as possible, following the steps in “Complaints and Investigations” below. Nobody is punished for reporting in good faith, for supporting a colleague’s report or for taking part in an investigation.",
            "Every year you complete the New York State sexual harassment prevention training (a short video, on paid time): it is listed under Documents in the app."
          ]
        },
        {
          "h": "Purpose and Goals",
          "blocks": [
            "Bar Lento is committed to maintaining a workplace free from harassment and discrimination. Sexual harassment is a form of workplace discrimination that subjects an employee to inferior conditions of employment due to their gender, gender identity, gender expression (perceived or actual), and/or sexual orientation. Sexual harassment is often viewed simply as a form of gender-based discrimination, but Bar Lento recognizes that discrimination can be related to or affected by other identities beyond gender. Under the New York State Human Rights Law, it is illegal to discriminate based on sex, sexual orientation, gender identity or expression, age, race, creed, color, national origin, military status, disability, pre-disposing genetic characteristics, familial status, marital status, criminal history, or status as a victim of domestic violence. Our different identities impact our understanding of the world and how others perceive us. For example, an individual’s race, ability, or immigration status may impact their experience with gender discrimination in the workplace. While this policy is focused on sexual harassment and gender discrimination, the methods for reporting and investigating discrimination based on other protected identities are the same. The purpose of this policy is to teach employees to recognize discrimination, including discrimination due to an individual’s intersecting identities, and provide the tools to take action when it occurs. All employees, managers, and supervisors are required to work in a manner designed to prevent sexual harassment and discrimination in the workplace. This policy is one component of Bar Lento’s commitment to a discrimination-free work environment.",
            "Goals of this Policy",
            "Sexual harassment and discrimination are against the law. After reading this policy, employees will understand their right to a workplace free from harassment. Employees will also learn what harassment and discrimination look like, what actions they can take to prevent and report harassment, and how they are protected from retaliation after taking action. The policy will also explain the investigation process into any claims of harassment. Employees are encouraged to report sexual harassment or discrimination by filing a complaint internally with Bar Lento. Employees can also file a complaint with a government agency or in court under federal, state, or local antidiscrimination laws. To file an employment complaint with the New York State Division of Human Rights, please visit https://dhr.ny.gov/complaint. To file a complaint with the United States Equal Employment Opportunity Commission, please visit https://www.eeoc.gov/filing-charge-discrimination."
          ]
        },
        {
          "h": "Sexual Harassment and Discrimination Prevention Policy",
          "blocks": [
            [
              "Bar Lento’s policy applies to all employees, applicants for employment, and interns, whether paid or unpaid. The policy also applies to additional covered individuals. It applies to anyone who is (or is employed by) a contractor, subcontractor, vendor, consultant, or anyone providing services in our workplace. These individuals include persons commonly referred to as independent contractors, gig workers, and temporary workers. Also included are persons providing equipment repair, cleaning services, or any other services through a contract with Bar Lento. For the remainder of this policy, we will use the term “covered individual” to refer to these individuals who are not direct employees of the company.",
              "Sexual harassment is unacceptable. Any employee or covered individual who engages in sexual harassment, discrimination, or retaliation will be subject to action, including appropriate discipline for employees. In New York, harassment does not need to be severe or pervasive to be illegal. Employees and covered individuals should not feel discouraged from reporting harassment because they do not believe it is bad enough, or conversely because they do not want to see a colleague fired over less severe behavior. Just as harassment can happen in different degrees, potential discipline for engaging in sexual harassment will depend on the degree of harassment and might include education and counseling. It may lead to suspension or termination when appropriate.",
              "Retaliation is prohibited. Any employee or covered individual that reports an incident of sexual harassment or discrimination, provides information, or otherwise assists in any investigation of a sexual harassment or discrimination complaint is protected from retaliation. No one should fear reporting sexual harassment if they believe it has occurred. So long as a person reasonably believes that they have witnessed or experienced such behavior, they are protected from retaliation. Any employee of Bar Lento who retaliates against anyone involved in a sexual harassment or discrimination investigation will face disciplinary action, up to and including termination. All employees and covered individuals working in the workplace who believe they have been subject to such retaliation should inform a supervisor, manager, or one of the Owners (Simone Viola or Chiara Tinazzi; contact details are at the end of this policy). All employees and covered individuals who believe they have been a target of such retaliation may also seek relief from government agencies, as explained below in the section on Legal Protections.",
              "Discrimination of any kind, including sexual harassment, is a violation of our policies, is unlawful, and may subject Bar Lento to liability for the harm experienced by targets of discrimination. Harassers may also be individually subject to liability and employers or supervisors who fail to report or act on harassment may be liable for aiding and abetting such behavior. Employees at every level who engage in harassment or discrimination, including managers and supervisors who engage in harassment or discrimination or who allow such behavior to continue, will be penalized for such misconduct.",
              "Bar Lento will conduct a prompt and thorough investigation that is fair to all parties. An investigation will happen whenever management receives a complaint about discrimination or sexual harassment, or when it otherwise knows of possible discrimination or sexual harassment occurring. Bar Lento will keep the investigation confidential to the extent possible. If an investigation ends with the finding that discrimination or sexual harassment occurred, Bar Lento will act as required. In addition to any required discipline, Bar Lento will also take steps to ensure a safe work environment for the employee(s) who experienced the discrimination or harassment. All employees, including managers and supervisors, are required to cooperate with any internal investigation of discrimination or sexual harassment.",
              "All employees and covered individuals are encouraged to report any harassment or behaviors that violate this policy. All employees will have access to a complaint form to report harassment and file complaints. Use of this form is not required. For anyone who would rather make a complaint verbally, or by email, these complaints will be treated with equal priority. An employee or covered individual who prefers not to report harassment to their manager or employer may instead report harassment to the New York State Division of Human Rights and/or the United States Equal Employment Opportunity Commission. Complaints may be made to both the employer and a government agency."
            ],
            "Managers and supervisors are required to report any complaint that they receive, or any harassment that they observe or become aware of, to one of the Owners (Simone Viola or Chiara Tinazzi; contact details are at the end of this policy).",
            "This policy applies to all employees and covered individuals, such as contractors, subcontractors, vendors, consultants, or anyone providing services in the workplace, and all must follow and uphold this policy. This policy is given to every employee when hired, is posted in the staff area, and is available at any time in the Bar Lento schedule app (My week → Documents) and at bar-lento.vercel.app/docs.html."
          ]
        },
        {
          "h": "What Is Sexual Harassment?",
          "blocks": [
            "Sexual harassment is a form of gender-based discrimination that is unlawful under federal, state, and (where applicable) local law. Sexual harassment includes harassment on the basis of sex, sexual orientation, self-identified or perceived sex, gender expression, gender identity, and the status of being transgender. Sexual harassment is not limited to sexual contact, touching, or expressions of a sexually suggestive nature. Sexual harassment includes all forms of gender discrimination including gender role stereotyping and treating employees differently because of their gender.",
            "Understanding gender diversity is essential to recognizing sexual harassment because discrimination based on sex stereotypes, gender expression and perceived identity are all forms of sexual harassment. The gender spectrum is nuanced, but the three most common ways people identify are cisgender, transgender, and non-binary. A cisgender person is someone whose gender aligns with the sex they were assigned at birth. Generally, this gender will align with the binary of male or female. A transgender person is someone whose gender is different than the sex they were assigned at birth. A non-binary person does not identify exclusively as a man or a woman. They might identify as both, somewhere in between, or completely outside the gender binary. Some may identify as transgender, but not all do. Respecting an individual’s gender identity is a necessary first step in establishing a safe workplace.",
            "Sexual harassment is unlawful when it subjects an individual to inferior terms, conditions, or privileges of employment. Harassment does not need to be severe or pervasive to be illegal. It can be any harassing behavior that rises above petty slights or trivial inconveniences. Every instance of harassment is unique to those experiencing it, and there is no single boundary between petty slights and harassing behavior. However, the Human Rights Law specifies that whether harassing conduct is considered petty or trivial is to be viewed from the standpoint of a reasonable victim of discrimination with the same protected characteristics. Generally, any behavior in which an employee or covered individual is treated worse because of their gender (perceived or actual), sexual orientation, or gender expression is considered a violation of Bar Lento’s policy. The intent of the behavior, for example, making a joke, does not neutralize a harassment claim. Not intending to harass is not a defense. The impact of the behavior on a person is what counts. Sexual harassment includes any unwelcome conduct which is either directed at an individual because of that individual’s gender identity or expression (perceived or actual), or is of a sexual nature when:",
            [
              "The purpose or effect of this behavior unreasonably interferes with an individual’s work performance or creates an intimidating, hostile or offensive work environment. The impacted person does not need to be the intended target of the sexual harassment;",
              "Employment depends implicitly or explicitly on accepting such unwelcome behavior; or",
              "Decisions regarding an individual’s employment are based on an individual’s acceptance to or rejection of such behavior. Such decisions can include what shifts and how many hours an employee might work, project assignments, as well as salary and promotion decisions."
            ],
            "There are two main types of sexual harassment:",
            [
              "Behaviors that contribute to a hostile work environment include, but are not limited to, words, signs, jokes, pranks, intimidation, or physical violence which are of a sexual nature, or which are directed at an individual because of that individual’s sex, gender identity, or gender expression. Sexual harassment also consists of any unwanted verbal or physical advances, sexually explicit derogatory, or discriminatory statements which an employee finds offensive or objectionable, causes an employee discomfort or humiliation, or interferes with the employee’s job performance.",
              "Sexual harassment also occurs when a person in authority tries to trade job benefits for sexual favors. This can include hiring, promotion, continued employment or any other terms, conditions, or privileges of employment. This is also called quid pro quo harassment."
            ],
            "Any employee or covered individual who feels harassed is encouraged to report the behavior so that any violation of this policy can be corrected promptly. Any harassing conduct, even a single incident, can be discrimination and is covered by this policy."
          ]
        },
        {
          "h": "Examples of Sexual Harassment",
          "blocks": [
            "The following describes some of the types of acts that may be unlawful sexual harassment and that are strictly prohibited. This list is just a sample of behaviors and should not be considered exhaustive. Any employee who believes they have experienced sexual harassment, even if it does not appear on this list, should feel encouraged to report it:",
            [
              {
                "t": "Physical acts of a sexual nature, such as:",
                "sub": [
                  "Touching, pinching, patting, kissing, hugging, grabbing, brushing against another employee’s body, or poking another employee’s body; or",
                  "Rape, sexual battery, molestation, or attempts to commit these assaults, which may be considered criminal conduct outside the scope of this policy (please contact local law enforcement if you wish to pursue criminal charges)."
                ]
              },
              {
                "t": "Unwanted sexual comments, advances, or propositions, such as:",
                "sub": [
                  {
                    "t": "Requests for sexual favors accompanied by implied or overt threats concerning the target’s job performance evaluation, a promotion, or other job benefits;",
                    "sub": [
                      "This can include sexual advances/pressure placed on a service industry employee by customers or clients, especially those industries where hospitality and tips are essential to the customer/employee relationship;"
                    ]
                  },
                  "Subtle or obvious pressure for unwelcome sexual activities; or",
                  "Repeated requests for dates or romantic gestures, including gift-giving."
                ]
              },
              "Sexually oriented gestures, noises, remarks or jokes, or questions and comments about a person’s sexuality, sexual experience, or romantic history which create a hostile work environment. This is not limited to interactions in person. Remarks made over virtual platforms and in messaging apps when employees are working remotely can create a similarly hostile work environment.",
              {
                "t": "Sex stereotyping, which occurs when someone’s conduct or personality traits are judged based on other people's ideas or perceptions about how individuals of a particular sex should act or look:",
                "sub": [
                  "Remarks regarding an employee’s gender expression, such as wearing a garment typically associated with a different gender identity; or",
                  "Asking employees to take on traditionally gendered roles, such as asking a woman to serve meeting refreshments when it is not part of, or appropriate to, her job duties."
                ]
              },
              {
                "t": "Sexual or discriminatory displays or publications anywhere in the workplace, such as:",
                "sub": [
                  "Displaying pictures, posters, calendars, graffiti, objects, promotional material, reading materials, or other materials that are sexually demeaning or pornographic. This includes such sexual displays on workplace computers or cell phones and sharing such displays while in the workplace;",
                  "This also extends to the virtual or remote workspace and can include having such materials visible in the background of one’s home during a virtual meeting."
                ]
              },
              {
                "t": "Hostile actions taken against an individual because of that individual’s sex, sexual orientation, gender identity, or gender expression, such as:",
                "sub": [
                  "Interfering with, destroying, or damaging a person’s workstation, tools or equipment, or otherwise interfering with the individual’s ability to perform the job;",
                  "Sabotaging an individual’s work;",
                  "Bullying, yelling, or name-calling;",
                  "Intentional misuse of an individual’s preferred pronouns; or",
                  {
                    "t": "Creating different expectations for individuals based on their perceived identities:",
                    "sub": [
                      "Dress codes that place more emphasis on women’s attire;",
                      "Leaving parents/caregivers out of meetings."
                    ]
                  }
                ]
              }
            ]
          ]
        },
        {
          "h": "Who Can Be a Target of Sexual Harassment?",
          "blocks": [
            "Sexual harassment can occur between any individuals, regardless of their sex or gender. Harassment does not have to be between members of the opposite sex or gender. New York Law protects employees and all covered individuals described earlier in the policy. Harassers can be anyone in the workplace. A supervisor, a supervisee, or a coworker can all be harassers. Anyone else in the workplace can also be harassers including an independent contractor, contract worker, vendor, client, customer, patient, constituent, or visitor.",
            "Sexual harassment does not happen in a vacuum and discrimination experienced by an employee can be impacted by biases and identities beyond an individual’s gender. For example:",
            [
              "Placing different demands or expectations on black women employees than white women employees can be both racial and gender discrimination;",
              "An individual’s immigration status may lead to perceptions of vulnerability and increased concerns around illegal retaliation for reporting sexual harassment; or",
              "Past experiences as a survivor of domestic or sexual violence may lead an individual to feel re-traumatized by someone’s behaviors in the workplace."
            ],
            "Individuals bring personal history with them to the workplace that might impact how they interact with certain behavior. It is especially important for all employees to be aware of how words or actions might impact someone with a different experience than their own in the interest of creating a safe and equitable workplace."
          ]
        },
        {
          "h": "Where Can Sexual Harassment Occur?",
          "blocks": [
            "Unlawful sexual harassment is not limited to the physical workplace itself. It can occur while employees are traveling for business or at employer or industry sponsored events or parties. Calls, texts, emails, and social media usage by employees or covered individuals can constitute unlawful workplace harassment, even if they occur away from the workplace premises, on personal devices, or during non-work hours.",
            "Sexual harassment can occur when employees are working remotely from home as well. Any behaviors outlined above that leave an employee feeling uncomfortable, humiliated, or unable to meet their job requirements constitute harassment even if the employee or covered individual is at home when the harassment occurs. Harassment can happen on virtual meeting platforms, in messaging apps, and after working hours between personal cell phones."
          ]
        },
        {
          "h": "Retaliation",
          "blocks": [
            "Retaliation is unlawful and is any action by an employer or supervisor that punishes an individual upon learning of a harassment claim, that seeks to discourage a worker or covered individual from making a formal complaint or supporting a sexual harassment or discrimination claim, or that punishes those who have come forward. These actions need not be job-related or occur in the workplace to constitute unlawful retaliation. For example, threats of physical violence outside of work hours or disparaging someone on social media would be covered as retaliation under this policy.",
            "Examples of retaliation may include, but are not limited to:",
            [
              "Demotion, termination, denying accommodations, reduced hours, or the assignment of less desirable shifts;",
              "Publicly releasing personnel files;",
              "Refusing to provide a reference or providing an unwarranted negative reference;",
              "Labeling an employee as “difficult” and excluding them from projects to avoid “drama”;",
              "Undermining an individual’s immigration status; or",
              "Reducing work responsibilities, passing over for a promotion, or moving an individual’s desk to a less desirable office location."
            ],
            "Such retaliation is unlawful under federal, state, and (where applicable) local law. The New York State Human Rights Law protects any individual who has engaged in “protected activity.” Protected activity occurs when a person has:",
            [
              "Made a complaint of sexual harassment or discrimination, either internally or with any government agency;",
              "Testified or assisted in a proceeding involving sexual harassment or discrimination under the Human Rights Law or any other anti-discrimination law;",
              "Opposed sexual harassment or discrimination by making a verbal or informal complaint to management, or by simply informing a supervisor or manager of suspected harassment;",
              "Reported that another employee has been sexually harassed or discriminated against; or",
              "Encouraged a fellow employee to report harassment."
            ],
            "Even if the alleged harassment does not turn out to rise to the level of a violation of law, the individual is protected from retaliation if the person had a good faith belief that the practices were unlawful. However, the retaliation provision is not intended to protect persons making intentionally false charges of harassment."
          ]
        },
        {
          "h": "Reporting Sexual Harassment",
          "blocks": [
            "Everyone must work toward preventing sexual harassment, but leadership matters. Supervisors and managers have a special responsibility to make sure employees feel safe at work and that workplaces are free from harassment and discrimination. Any employee or covered individual is encouraged to report harassing or discriminatory behavior to a supervisor, manager or one of the Owners (Simone Viola or Chiara Tinazzi; contact details are at the end of this policy). Anyone who witnesses or becomes aware of potential instances of sexual harassment should report such behavior to a supervisor, manager, or one of the Owners (Simone Viola or Chiara Tinazzi; contact details are at the end of this policy).",
            "Reports of sexual harassment may be made verbally or in writing. A written complaint form is attached to this policy if an employee would like to use it, but the complaint form is not required. Employees who are reporting sexual harassment on behalf of other employees may use the complaint form and should note that it is on another employee’s behalf. A verbal or otherwise written complaint (such as an email) on behalf of oneself or another employee is also acceptable.",
            "Employees and covered individuals who believe they have been a target of sexual harassment may at any time seek assistance in additional available forums, as explained below in the section on Legal Protections."
          ]
        },
        {
          "h": "Supervisory Responsibilities",
          "blocks": [
            "Supervisors and managers have a responsibility to prevent sexual harassment and discrimination. All supervisors and managers who receive a complaint or information about suspected sexual harassment, observe what may be sexually harassing or discriminatory behavior, or for any reason suspect that sexual harassment or discrimination is occurring, are required to report such suspected sexual harassment to one of the Owners (Simone Viola or Chiara Tinazzi; contact details are at the end of this policy). Managers and supervisors should not be passive and wait for an employee to make a claim of harassment. If they observe such behavior, they must act.",
            "Supervisors and managers can be disciplined if they engage in sexually harassing or discriminatory behavior themselves. Supervisors and managers can also be disciplined for failing to report suspected sexual harassment or allowing sexual harassment to continue after they know about it.",
            "Supervisors and managers will also be subject to discipline for engaging in any retaliation.",
            "While supervisors and managers have a responsibility to report harassment and discrimination, supervisors and managers must be mindful of the impact that harassment and a subsequent investigation has on victims. Being identified as a possible victim of harassment and questioned about harassment and discrimination can be intimidating, uncomfortable and re-traumatizing for individuals. Supervisors and managers must accommodate the needs of individuals who have experienced harassment to ensure the workplace is safe, supportive, and free from retaliation for them during and after any investigation."
          ]
        },
        {
          "h": "Bystander Intervention",
          "blocks": [
            "Any employee witnessing harassment as a bystander is encouraged to report it. A supervisor or manager that is a bystander to harassment is required to report it. There are five standard methods of bystander intervention that can be used when anyone witnesses harassment or discrimination and wants to help.",
            [
              "A bystander can interrupt the harassment by engaging with the individual being harassed and distracting them from the harassing behavior;",
              "A bystander who feels unsafe interrupting on their own can ask a third party to help intervene in the harassment;",
              "A bystander can record or take notes on the harassment incident to benefit a future investigation;",
              "A bystander might check in with the person who has been harassed after the incident, see how they are feeling and let them know the behavior was not ok; and",
              "If a bystander feels safe, they can confront the harassers and name the behavior as inappropriate. When confronting harassment, physically assaulting an individual is never an appropriate response."
            ],
            "Though not exhaustive, and dependent on the circumstances, the guidelines above can serve as a brief guide of how to react when witnessing harassment in the workplace. Any employee witnessing harassment as a bystander is encouraged to report it. A supervisor or manager that is a bystander to harassment is required to report it."
          ]
        },
        {
          "h": "Complaints and Investigations of Sexual Harassment",
          "blocks": [
            "All complaints or information about sexual harassment will be investigated, whether that information was reported in verbal or written form. An investigation of any complaint, information, or knowledge of suspected sexual harassment will be prompt, thorough, and started and completed as soon as possible. The investigation will be kept confidential to the extent possible. All individuals involved, including those making a harassment claim, witnesses, and alleged harassers deserve a fair and impartial investigation.",
            "Any employee may be required to cooperate as needed in an investigation of suspected sexual harassment. Bar Lento will take disciplinary action against anyone engaging in retaliation against employees who file complaints, support another’s complaint, or participate in harassment investigations.",
            "Bar Lento recognizes that participating in a harassment investigation can be uncomfortable and has the potential to retraumatize an employee. Those receiving claims and leading investigations will handle complaints and questions with sensitivity toward those participating.",
            "While the process may vary from case to case, investigations will be done in accordance with the following steps. Upon receipt of a complaint, the Owners (or, if the complaint concerns an Owner, the other Owner):",
            [
              "Will conduct a prompt review of the allegations, assess the appropriate scope of the investigation, and take any interim actions (for example, instructing the individual(s) about whom the complaint was made to refrain from communications with the individual(s) who reported the harassment), as appropriate. If the complaint is verbal, will ask the individual to complete the complaint form in writing. If the person reporting prefers not to fill out the form, the Owners will prepare a complaint form or equivalent documentation based on the verbal reporting;",
              "Will take steps to obtain, review, and preserve documents sufficient to assess the allegations, including documents, emails or phone records that may be relevant to the investigation. The Owners will consider and implement appropriate document request, review, and preservation measures, including for electronic communications;",
              "Will seek to interview all parties involved, including any relevant witnesses;",
              {
                "t": "Will create a written documentation of the investigation (such as a letter, memo or email), which contains the following:",
                "sub": [
                  "A list of all documents reviewed, along with a detailed summary of relevant documents;",
                  "A list of names of those interviewed, along with a detailed summary of their statements;",
                  "A timeline of events;",
                  "A summary of any prior relevant incidents disclosed in the investigation, reported or unreported; and",
                  "The basis for the decision and final resolution of the complaint, together with any corrective action(s)."
                ]
              },
              "Will keep the written documentation and associated documents in a secure and confidential location;",
              "Will promptly notify the individual(s) who reported the harassment and the individual(s) about whom the complaint was made that the investigation has been completed and implement any corrective actions identified in the written document; and",
              "Will inform the individual(s) who reported of the right to file a complaint or charge externally as outlined in the next section."
            ]
          ]
        },
        {
          "h": "Legal Protections and External Remedies",
          "blocks": [
            "Sexual harassment is not only prohibited by Bar Lento, but it is also prohibited by state, federal, and, where applicable, local law.",
            "The internal process outlined in the policy above is one way for employees to report sexual harassment. Employees and covered individuals may also choose to pursue legal remedies with the following governmental entities. While a private attorney is not required to file a complaint with a governmental agency, you may also seek the legal advice of an attorney."
          ]
        },
        {
          "h": "New York State Division of Human Rights",
          "blocks": [
            "The New York State Human Rights Law (HRL), N.Y. Executive Law, art. 15, § 290 et seq., applies to all employers in New York State and protects employees and covered individuals, regardless of immigration status. A complaint alleging violation of the Human Rights Law may be filed either with the New York State Division of Human Rights (DHR) or in New York State Supreme Court.",
            "Complaints of sexual harassment filed with DHR may be submitted any time within three years of the harassment. If an individual does not file a complaint with DHR, they can bring a lawsuit directly in state court under the Human Rights Law, within three years of the alleged sexual harassment. An individual may not file with DHR if they have already filed a HRL complaint in state court.",
            "Complaining internally to Bar Lento does not extend your time to file with DHR or in court. The three years are counted from the date of the most recent incident of harassment.",
            "You do not need an attorney to file a complaint with DHR, and there is no cost to file with DHR.",
            "DHR will investigate your complaint and determine whether there is probable cause to believe that sexual harassment has occurred. Probable cause cases receive a public hearing before an administrative law judge. If sexual harassment is found at the hearing, DHR has the power to award relief. Relief varies but it may include requiring your employer to take action to stop the harassment, or repair the damage caused by the harassment, including paying of monetary damages, punitive damages, attorney’s fees, and civil fines.",
            "DHR’s main office contact information is: NYS Division of Human Rights, One Fordham Plaza, Fourth Floor, Bronx, New York 10458. You may call (718) 741-8400 or visit: www.dhr.ny.gov.",
            "Go to dhr.ny.gov/complaint for more information about filing a complaint with DHR. The website has a digital complaint process that can be completed on your computer or mobile device from start to finish. The website has a complaint form that can be downloaded, filled out, and mailed to DHR as well as a form that can be submitted online. The website also contains contact information for DHR’s regional offices across New York State.",
            "Call the DHR sexual harassment hotline at 1(800) HARASS3 (1-800-427-2773) for more information about filing a sexual harassment complaint. This hotline can also provide you with a referral to a volunteer attorney experienced in sexual harassment matters who can provide you with limited free assistance and counsel over the phone."
          ]
        },
        {
          "h": "The United States Equal Employment Opportunity Commission",
          "blocks": [
            "The United States Equal Employment Opportunity Commission (EEOC) enforces federal anti-discrimination laws, including Title VII of the 1964 federal Civil Rights Act, 42 U.S.C. § 2000e et seq. An individual can file a complaint with the EEOC anytime within 300 days from the most recent incident of harassment. There is no cost to file a complaint with the EEOC. The EEOC will investigate the complaint and determine whether there is reasonable cause to believe that discrimination has occurred. If the EEOC determines that the law may have been violated, the EEOC will try to reach a voluntary settlement with the employer. If the EEOC cannot reach a settlement, the EEOC (or the Department of Justice in certain cases) will decide whether to file a lawsuit. The EEOC will issue a Notice of Right to Sue permitting workers to file a lawsuit in federal court if the EEOC closes the charge, is unable to determine if federal employment discrimination laws may have been violated, or believes that unlawful discrimination occurred but does not file a lawsuit.",
            "Individuals may obtain relief in mediation, settlement or conciliation. In addition, federal courts may award remedies if discrimination is found to have occurred. In general, private employers must have at least 15 employees to come within the jurisdiction of the EEOC.",
            "An employee alleging discrimination at work can file a “Charge of Discrimination.” The EEOC has district, area, and field offices where complaints can be filed. Contact the EEOC by calling 1-800-669-4000 (TTY: 1-800-669-6820), visiting their website at www.eeoc.gov or via email at info@eeoc.gov.",
            "If an individual filed an administrative complaint with the New York State Division of Human Rights, DHR will automatically file the complaint with the EEOC to preserve the right to proceed in federal court."
          ]
        },
        {
          "h": "Local Protections",
          "blocks": [
            "Many localities enforce laws protecting individuals from sexual harassment and discrimination. An individual should contact the county, city or town in which they live to find out if such a law exists. For example, employees who work in New York City may file complaints of sexual harassment or discrimination with the New York City Commission on Human Rights. Contact their main office at Law Enforcement Bureau of the NYC Commission on Human Rights, 22 Reade Street, 1st Floor, New York, New York 10007; call 311 or (212) 306-7450; or visit www.nyc.gov/cchr."
          ]
        },
        {
          "h": "Contact the Local Police Department",
          "blocks": [
            "If the harassment involves unwanted physical touching, coerced physical confinement, or coerced sex acts, the conduct may constitute a crime. Those wishing to pursue criminal charges are encouraged to contact their local police department."
          ]
        },
        {
          "h": "Conclusion",
          "blocks": [
            "The policy outlined above is aimed at providing employees at Bar Lento and covered individuals an understanding of their right to a discrimination- and harassment-free workplace. All employees should feel safe at work. Though the focus of this policy is on sexual harassment and gender discrimination, the New York State Human Rights Law protects against discrimination in several protected classes including sex, sexual orientation, gender identity or expression, age, race, creed, color, national origin, military status, disability, pre-disposing genetic characteristics, familial status, marital status, criminal history, or domestic violence survivor status. The prevention policies outlined above should be considered applicable to all protected classes."
          ]
        },
        {
          "h": "Complaint Form",
          "blocks": [
            "New York State Labor Law requires all employers to adopt a sexual harassment prevention policy that includes a complaint form to report alleged incidents of sexual harassment. If you believe that you have been subjected to sexual harassment or gender discrimination, you are encouraged, but not required, to complete this form and give it to one of the Owners: in person, on paper, or by email to simoneviola@barlentony.com or chiaratinazzi@barlentony.com. No employee will be retaliated against for filing a complaint.",
            "If you are more comfortable reporting verbally or in another manner, Bar Lento will complete this form for you, give you a copy, and follow this policy by investigating the claims. You may also use this form to report on behalf of another employee: say so on the form.",
            "The form asks for:",
            [
              "Your information: name, job title, work phone, email, and how you prefer to be contacted (email, phone or in person).",
              "Your immediate supervisor: name and title.",
              "Who your complaint is about: name, title, and their relationship to you (supervisor, supervisee, co-worker, guest, other).",
              "What happened, with as many details as possible. Use extra pages if you need them and attach any relevant documents, messages or photos.",
              "The date or dates it occurred, and whether it is continuing.",
              "Witnesses or people who may have information (optional, but it helps the investigation).",
              "Whether you previously reported related incidents, verbally or in writing: when, and to whom.",
              "Optional: if you have an attorney and would like us to work with them, their contact information.",
              "Your signature and the date."
            ],
            "A printable copy of the form is at the end of the printable version of this policy (bar-lento.vercel.app/docs.html?id=harassment). For additional resources, visit ny.gov/programs/combating-sexual-harassment-workplace."
          ]
        }
      ],
      "links": [
        {
          "label": "New York State model policy (official PDF)",
          "url": "https://www.ny.gov/sites/default/files/2024-08/SexualHarassmentModelPolicyUpdated.pdf"
        },
        {
          "label": "File a complaint with the NYS Division of Human Rights",
          "url": "https://dhr.ny.gov/complaint"
        },
        {
          "label": "NYC Commission on Human Rights — Stop Sexual Harassment Act fact sheet",
          "url": "https://www.nyc.gov/assets/cchr/downloads/pdf/materials/SexHarass_Factsheet-English.pdf"
        },
        {
          "label": "U.S. EEOC — filing a charge",
          "url": "https://www.eeoc.gov/filing-charge-discrimination"
        }
      ],
      "ack": "I confirm that I have received and read Bar Lento’s Sexual Harassment Prevention Policy, including the complaint form, and that I know how and to whom I can report harassment or discrimination."
    },
    {
      "id": "training",
      "version": "2026",
      "yearly": true,
      "kind": "training",
      "title": "Sexual Harassment Prevention Training",
      "short": "Annual training",
      "subtitle": "Required every year by New York State Labor Law §201-g · New York State model training",
      "intro": "New York State requires every employee to complete interactive sexual harassment prevention training every year, and new employees as soon as possible after they start. Bar Lento uses the State’s official training video, in English or in English with Italian subtitles. Watching it is paid working time: watch it during a shift when the floor is quiet, or tell the Manager the time you spent so it is added to your paid hours.",
      "sections": [
        {
          "h": "How to complete it",
          "blocks": [
            [
              "Watch the New York State model training video (links below): the English video, or the version with Italian subtitles in two parts (Part 1: training, Part 2: case studies). It takes about half an hour. Watch it to the end.",
              "If you choose the version with Italian subtitles, watch both parts.",
              "If anything is unclear, ask an Owner in person or by email. Your questions and our answers are part of the training (that is what makes it “interactive”) and are answered within a few days.",
              "Then tick the box below and confirm with your email. Your confirmation is emailed to you and to the Owners and kept as Bar Lento’s training record for this year.",
              "You are asked again every year, in January. Bar Lento also keeps the Sexual Harassment Prevention Policy under Documents: you can reread it at any time."
            ]
          ]
        },
        {
          "h": "What the training covers",
          "blocks": [
            [
              "What sexual harassment is under New York State law, with concrete examples, including harassment by guests.",
              "Your rights, the remedies available to you, and how to report internally at Bar Lento and externally to the NYS Division of Human Rights, the NYC Commission on Human Rights and the U.S. EEOC.",
              "The responsibilities of supervisors and managers, and how bystanders can help safely.",
              "Bar Lento’s policy against retaliation: nobody is punished for reporting in good faith."
            ]
          ]
        }
      ],
      "links": [
        {
          "label": "Training video — English (New York State)",
          "url": "https://www.youtube.com/watch?v=A9gudpiQ40M"
        },
        {
          "label": "Training video, Part 1 — Italian subtitles (New York State)",
          "url": "https://youtu.be/sdMlIwc5Nj8"
        },
        {
          "label": "Training video, Part 2: case studies — Italian subtitles (New York State)",
          "url": "https://www.youtube.com/watch?v=DslsQ_Mklyw"
        },
        {
          "label": "New York State training page (all languages, script and slides)",
          "url": "https://www.ny.gov/combating-sexual-harassment-workplace/sexual-harassment-prevention-model-policy-and-training"
        }
      ],
      "ack": "I confirm that I have watched the New York State sexual harassment prevention training video to the end this year, that I understand it, and that I know I can ask the Owners questions about it at any time."
    },
    {
      "id": "pto",
      "version": "2026-09-18",
      "kind": "policy",
      "title": "Protected Time Off (Safe and Sick Leave) Policy",
      "short": "Sick leave policy",
      "subtitle": "New York City Earned Safe and Sick Time Act (as amended February 22, 2026) · New York State Paid Sick Leave Law (Labor Law §196-b) · Paid Prenatal Leave",
      "intro": "This policy explains the time off the law guarantees you when you are sick, need to care for someone, or need to deal with a safety issue, and how to use it at Bar Lento. Bar Lento has between 5 and 99 employees, so the amounts below apply. The law is a minimum: nothing in this policy takes away any right the law gives you, and where this policy and the law differ, the law prevails. Bar Lento’s calendar year for this policy is January 1 – December 31. Ask an Owner or the Manager if anything is unclear, or if you would prefer it explained in Italian.",
      "sections": [
        {
          "h": "1. What you get each calendar year",
          "blocks": [
            [
              "Paid protected time off: you earn 1 hour of paid protected time off for every 30 hours you work, from your first day, up to 40 hours per calendar year (this is also your New York State paid sick leave: the two laws overlap, and you get the better of the two). You can use it as soon as you have earned it: there is no waiting period, probation period or blackout period.",
              "Unpaid protected time off: 32 hours are available immediately, on your first day and again on January 1 of every year. Use them when you have not yet earned enough paid hours, or after your paid hours are used up. Unused unpaid hours do not carry over to the next year.",
              "Paid prenatal leave: a separate bank of 20 hours of paid leave per 52-week period for health care during your own pregnancy (exams, tests, procedures, monitoring, consultations, fertility treatment, end-of-pregnancy care). The 52 weeks start the first time you use it. This is in addition to the hours above, and you choose which bank to use for a prenatal appointment.",
              "Carryover: up to 40 hours of unused earned paid protected time off carry over to the next calendar year. You can still use at most 40 hours of paid protected time off per calendar year.",
              "Accrual counts every hour you work, rounded to the nearest 15 minutes, and appears on every pay statement (see section 6)."
            ]
          ]
        },
        {
          "h": "2. What you can use it for",
          "blocks": [
            "Protected time off can be used for:",
            [
              "Your own mental or physical illness, injury or health condition; a medical diagnosis, care or treatment; or preventive care (check-ups, vaccinations, dental care).",
              "Caring for a family member who is sick, injured, needs diagnosis, care or treatment, or has a medical appointment.",
              "Caring for a child, including when their school or child care is closed (school holidays, snow days, child care disruptions), and caring for a family or household member with a disability.",
              "Safe time: if you or a family member are a victim of domestic violence, unwanted sexual contact, stalking, human trafficking or workplace violence, to get services or counseling, relocate, meet with an attorney or a social services provider, go to court, report to the police, serve as a witness, take safety measures, and similar needs.",
              "Attending public benefits or housing appointments and hearings.",
              "Staying home when a public official closes Bar Lento, or your child’s school or child care, because of a public health emergency, extreme weather or another public disaster."
            ],
            "“Family member” is broad: your child (biological, adopted, foster, legal ward, or a child you care for as a parent), spouse, registered domestic partner, parent (including step, foster, adoptive, legal guardian, or someone who raised you), the child or parent of your spouse or partner, grandchild, grandparent, sibling (including half, adopted or step), anyone else related to you by blood, and anyone whose close relationship with you is the equivalent of family.",
            "Paid prenatal leave is only for health care during your own pregnancy. To accompany a partner to a prenatal appointment, use protected time off."
          ]
        },
        {
          "h": "3. How to tell us",
          "blocks": [
            [
              "Planned absence (you know 7 or more days ahead: a doctor’s appointment, a court date, a school closure announced in advance): tell us as early as you can — at least 7 days before when you know that far ahead — by email to all the contacts at the end of this policy, or by text to the work phone number posted in the staff area. Say how many hours or which shifts you need. Bar Lento cannot ask for more than 7 days’ notice.",
              "Unplanned absence (you wake up sick, your child’s school closes suddenly): tell us as soon as you reasonably can, before your shift if possible, by text or call to the work phone number, or by email. No advance notice is required for an unplanned need.",
              "You never have to tell us the reason: saying “protected time off” or “sick” is enough. You never have to find your own replacement, and you never have to make up the hours.",
              "Bar Lento may ask you to confirm in writing (an email or a text is enough) that you used protected time off for a purpose allowed by law, without stating which one."
            ]
          ]
        },
        {
          "h": "4. Documentation",
          "blocks": [
            [
              "Bar Lento asks for documentation only if you use protected time off for more than 3 consecutive workdays. For 3 consecutive workdays or fewer, no documentation is ever requested.",
              "When it applies, you have at least 7 days from the day you return to work to provide it, by email or by hand to the Manager. You are never asked to provide it before you return.",
              "For a health reason, any written note signed by a licensed health care provider (including a social worker or a mental health counselor) stating that you needed the time off is enough. It does not have to state the diagnosis, and Bar Lento does not ask for it.",
              "For other purposes, any of these is enough: a letter from a school or child care provider; a letter from a services provider (attorney, clergy, court, government agency, medical or social services provider); a police, court or government record; or a notarized letter from you explaining the need.",
              "If the provider charges you for the note, Bar Lento reimburses you: send the receipt with the documentation. Your pay for the time off is never delayed while documentation is pending."
            ]
          ]
        },
        {
          "h": "5. How you are paid, and in what increments",
          "blocks": [
            [
              "Paid protected time off and paid prenatal leave are paid at your regular hourly wage at the time you take them, and never less than the full New York City minimum wage ($17.00 per hour in 2026), without any tip credit. Overtime rates do not apply, and tips you would have earned are not owed for hours not worked.",
              "It is paid on your regular pay date through Toast Payroll and shown on your pay statement.",
              "You can use protected time off for a whole shift or for any part of a shift: Bar Lento does not require a minimum amount of time (payroll records it to the nearest 15 minutes). The same applies to paid prenatal leave.",
              "If you leave Bar Lento, unused protected time off is not paid out (the law does not require it). If you are rehired within 6 months, your previous balance is restored and available immediately."
            ]
          ]
        },
        {
          "h": "6. Your pay statement",
          "blocks": [
            [
              "Every pay statement shows: the protected time off you earned during the pay period; the paid and unpaid protected time off you used during the pay period; the unpaid hours still available this calendar year; and the earned paid hours still available this calendar year.",
              "In any pay period in which you use paid prenatal leave, it also shows the prenatal leave used and the hours left in your 52-week period.",
              "If a figure looks wrong, tell the Manager or an Owner: we check the payroll record with you and correct any error in the next payroll."
            ]
          ]
        },
        {
          "h": "7. No retaliation, and where to get help",
          "blocks": [
            [
              "It is illegal to punish, threaten, discipline, reduce the hours of, or fire anyone for requesting or using protected time off or paid prenatal leave, or for reporting a violation. Using this leave is never counted as an attendance problem at Bar Lento, and it is never a factor in scheduling, promotion or discipline.",
              "You have these rights regardless of your immigration status.",
              "If you believe your rights were not respected, talk to an Owner. You can also contact the NYC Department of Consumer and Worker Protection: nyc.gov/workers, or call 311 and ask for “Protected Time Off” (you may also leave an anonymous tip). For New York State paid sick leave: dol.ny.gov/paid-sick-leave or 1-888-469-7365."
            ]
          ]
        },
        {
          "h": "8. Misuse",
          "blocks": [
            "Protected time off is for the purposes in section 2. Using it for another purpose, or giving false information to obtain it, may be treated like any other unexcused absence, but only after a fair conversation with you, and never on the basis of a guess about your reason."
          ]
        },
        {
          "h": "9. Notice of Employee Rights (New York City)",
          "blocks": [
            "The City’s official “Notice of Employee Rights: Protected Time Off” (dated February 22, 2026) is linked below in English and in Italian, and is posted in the staff area. On Bar Lento’s Notice the calendar year is January 1 – December 31. By acknowledging this policy you also confirm that you received the Notice; Bar Lento keeps the date and your confirmation, as the law requires. If your primary language is neither English nor Italian, ask an Owner: the City publishes the Notice in many other languages."
          ]
        },
        {
          "h": "10. Other laws that may give you more time off",
          "blocks": [
            "New York Paid Family Leave (paid weeks to bond with a new child, care for a seriously ill family member, or handle a family member’s military deployment, paid through insurance), New York disability benefits and workers’ compensation, and job-protected time for jury duty, voting, blood donation, bone marrow donation and military service. These are separate from protected time off. Ask an Owner: we help you with the forms."
          ]
        }
      ],
      "links": [
        {
          "label": "NYC Notice of Employee Rights: Protected Time Off — English (official PDF)",
          "url": "https://www.nyc.gov/assets/dca/downloads/pdf/about/PaidSafeSickLeave-MandatoryNotice-English.pdf"
        },
        {
          "label": "NYC Notice of Employee Rights: Protected Time Off — Italian (official PDF)",
          "url": "https://www.nyc.gov/assets/dca/downloads/pdf/about/PaidSafeSickLeave-MandatoryNotice-Italian.pdf"
        },
        {
          "label": "NYC Protected Time Off — frequently asked questions (DCWP)",
          "url": "https://www.nyc.gov/assets/dca/downloads/pdf/about/PaidSickLeave-FAQs.pdf"
        },
        {
          "label": "New York State Paid Sick Leave",
          "url": "https://dol.ny.gov/paid-sick-leave"
        }
      ],
      "ack": "I confirm that I have received and read Bar Lento’s Protected Time Off (Safe and Sick Leave) Policy and that I received the New York City Notice of Employee Rights: Protected Time Off."
    },
    {
      "id": "tips",
      "version": "2026-09-18",
      "kind": "policy",
      "title": "Tips Policy",
      "short": "Tips policy",
      "subtitle": "Gratuities at Bar Lento · New York Labor Law §196-d and the Hospitality Industry Wage Order (12 NYCRR Part 146)",
      "intro": "This policy explains how tips work at Bar Lento: what belongs to you, how card and cash tips reach you, and where to check them. Bar Lento does not operate a tip pool. Where this policy and the law differ, the law prevails.",
      "sections": [
        {
          "h": "1. Your tips are yours",
          "blocks": [
            "Every tip a guest leaves for you belongs to you. Bar Lento, the Owners and the Manager never take, hold or share any part of your tips, and never ask you to hand back tips to cover walkouts, breakage, mistakes, cash shortages, credit card chargebacks or anything else. New York law forbids any deduction from your wages or tips for these reasons."
          ]
        },
        {
          "h": "2. Card tips",
          "blocks": [
            "Tips paid by card, including tips added on Toast Pay, tap-to-pay and online orders, are recorded by Toast for the employee who served the guest and paid to you in full through Toast Payroll on your regular pay date, shown on your pay statement as a separate tip line. Bar Lento does not deduct card processing fees from your tips. The only amounts withheld are the taxes the law requires."
          ]
        },
        {
          "h": "3. Cash tips",
          "blocks": [
            "Cash tips are kept by the employee who received them. Bar Lento is card-first: cash payments are handled by the Manager or Owner on duty (see House Rules, section 11). A guest may still leave cash as a tip: it is yours. Declare your cash tips in Toast when you clock out (Declare Cash Tips): federal law requires you to report cash tips to your employer, and accurate reporting protects your Social Security, disability and unemployment benefits."
          ]
        },
        {
          "h": "4. No tip pool, no forced sharing",
          "blocks": [
            "Bar Lento does not operate a tip pool or mandatory tip sharing. If you voluntarily choose to share a tip with a colleague who helped you, that is between you. Nobody may pressure you to share, and the Manager and the Owners never take part in any sharing, as the law requires of anyone with authority over staff."
          ]
        },
        {
          "h": "5. Service charges and large parties",
          "blocks": [
            "If Bar Lento adds an automatic gratuity, or any charge described to guests as a tip, gratuity or service charge (for example for large parties or events), that money is a tip for the staff who served those guests and is paid to them in full through payroll. Bar Lento keeps none of it. Any charge that is not a tip is clearly described to guests as such."
          ]
        },
        {
          "h": "6. Your wage and the tip credit",
          "blocks": [
            "Your pay statement shows your hourly wage and your tips separately. If Bar Lento pays you the New York City tipped food-service wage with a tip credit, you received a written pay notice when you were hired (New York form LS 54) with the exact rates, and the law guarantees that your wage plus tips reach at least the full minimum wage every week: if they don’t, Bar Lento makes up the difference. When you use paid protected time off you are paid the full minimum wage, without tip credit."
          ]
        },
        {
          "h": "7. Checking your tips",
          "blocks": [
            "Toast shows your tips for every shift. If a figure looks wrong, tell the Manager before the end of the pay period: we check the Toast record together and correct any error in the next payroll."
          ]
        },
        {
          "h": "8. Guests and tips",
          "blocks": [
            "Never ask a guest for a tip, comment on the size of a tip, or treat a guest differently because of a tip. A guest who pressures you for anything in exchange for a tip is behaving unacceptably and may be harassing you: tell the Manager or Owner on duty at once (see the Sexual Harassment Prevention Policy)."
          ]
        },
        {
          "h": "9. Where to get help",
          "blocks": [
            "If you believe tips owed to you were not paid, talk to an Owner first. You can also contact the New York State Department of Labor, Division of Labor Standards: 1-888-52-LABOR (1-888-525-2267) or dol.ny.gov. Retaliation for asking about your tips or your pay is illegal."
          ]
        }
      ],
      "links": [
        {
          "label": "New York State Department of Labor — minimum wage for tipped workers",
          "url": "https://dol.ny.gov/minimum-wage-tipped-workers"
        }
      ],
      "ack": "I confirm that I have received and read Bar Lento’s Tips Policy."
    },
    {
      "id": "lactation",
      "version": "2026",
      "yearly": true,
      "kind": "policy",
      "title": "Policy on the Rights of Employees to Express Breast Milk in the Workplace",
      "short": "Lactation policy",
      "subtitle": "New York State Labor Law §206-c · based on the New York State Department of Labor model policy (2024 revision)",
      "intro": "Section 206-c of the New York State Labor Law gives all employees in New York the right to express breast milk in the workplace. This law applies to all employers in New York State, regardless of size. This policy tells you how much time you are allowed, the space Bar Lento provides, how to notify us, and how to contact the Department of Labor if these rights are not honored. Bar Lento gives this policy in writing to every employee when hired, re-sends it to everyone every January, and gives it again to employees returning to work after the birth of a child, as the law requires of every employer. It is here for whoever may need it, now or in the future: acknowledging it only means you have read it.",
      "sections": [
        {
          "h": "Break time for breast milk expression",
          "blocks": [
            [
              "Bar Lento provides a paid break of 30 minutes each time you reasonably need to express breast milk for your nursing child, for up to three years following childbirth. The number of breaks you need is personal, and break times are provided based on your needs.",
              "If you need more than 30 minutes, you may also use your paid break time or meal time, or take additional unpaid break time. You may work before or after your normal shift to make up unpaid break time, within Bar Lento’s normal hours, but you are not required to.",
              "Nobody can require you to work while expressing breast milk. If you voluntarily choose to, that time is paid as working time.",
              "Bar Lento does not discriminate in any way against an employee who chooses to express breast milk in the workplace, and does not retaliate against anyone who asks for these rights."
            ]
          ]
        },
        {
          "h": "The space at Bar Lento",
          "blocks": [
            "Bar Lento is a small venue without a spare room. When an employee needs to express breast milk, Bar Lento makes a private area of the back of house available for the duration of each break: never a restroom or toilet stall, closed to guests and colleagues while in use (a sign on the door or partition says so), shielded from view and free from intrusion, close to the work area, with good light, a chair, a flat surface, an electrical outlet and clean running water nearby. The exact spot, and any adjustment needed to make it private, is agreed in writing with the employee when they ask (see below), and it is kept clean at all times.",
            [
              "Expressed milk may be stored in the staff refrigerator, in a closed and labeled container, and taken home at the end of each day. Bar Lento cannot guarantee the safekeeping of milk stored in a shared refrigerator.",
              "The law allows a small business to meet as many of these requirements as it reasonably can when providing a dedicated room would cause undue hardship, but it never allows denying an employee the right to express breast milk at work: a private space is always provided."
            ]
          ]
        },
        {
          "h": "How to ask",
          "blocks": [
            [
              "Tell an Owner or the Manager in writing (an email or a text is fine), ideally before you return to work after your leave, so we can adjust schedules. Say roughly how many breaks you expect per shift and your preferred times.",
              "Bar Lento answers in writing within 5 business days, confirming the space and the times, and tells all staff by email or a note in the staff area when a space is designated.",
              "You can update your needs at any time: schedules are adjusted accordingly."
            ]
          ]
        },
        {
          "h": "Your rights and where to get help",
          "blocks": [
            [
              "If you believe you are experiencing retaliation for expressing breast milk at work, or that Bar Lento is not following this policy, talk to an Owner, and/or contact the New York State Department of Labor, Division of Labor Standards: call 1-888-52-LABOR (1-888-525-2267), email LSAsk@labor.ny.gov, or visit the nearest Labor Standards office (dol.ny.gov/location/contact-division-labor-standards). Complaints are confidential.",
              "Federal law also protects you: under the PUMP Act, workers not provided with breaks and adequate space for up to one year after the birth of a child can file a complaint with the U.S. Department of Labor (dol.gov/agencies/whd/pump-at-work).",
              "The New York City Human Rights Law also requires employers to accommodate lactation needs; you can contact the NYC Commission on Human Rights by calling 311."
            ]
          ]
        }
      ],
      "links": [
        {
          "label": "New York State Department of Labor — breast milk expression in the workplace",
          "url": "https://dol.ny.gov/expressing-breast-milk-workplace"
        },
        {
          "label": "Your rights as an employee to express breast milk at work (NYS DOL, PDF)",
          "url": "https://dol.ny.gov/system/files/documents/2024/06/p690-your-rights-as-an-employee-to-express-breast-milk-at-work-.pdf"
        },
        {
          "label": "U.S. Department of Labor — PUMP Act",
          "url": "https://www.dol.gov/agencies/whd/pump-at-work"
        }
      ],
      "ack": "I confirm that I have received and read Bar Lento’s Policy on the Rights of Employees to Express Breast Milk in the Workplace."
    }
  ]
};
if (typeof module !== "undefined" && module.exports) module.exports = DOCS; else root.BL_DOCS = DOCS;
})(typeof window !== "undefined" ? window : this);
