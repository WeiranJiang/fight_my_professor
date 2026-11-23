from pathlib import Path
from urllib.parse import urljoin, urlsplit
from collections import Counter
from bs4 import BeautifulSoup
import json, re, unicodedata, sys

# School, directory URL, cards, name, rank, interests, profile link.
spec = {
'penn':('https://www.cis.upenn.edu/faculty/','.card:has(h3.card-headline)','h3','.StaffListTitles strong',None,'a.arrow'),
'harvard':('https://seas.harvard.edu/computer-science/people','.person__detailed','.person__name','.person__primary-title',None,'.person__detailed-name a'),
'stanford':('https://www.cs.stanford.edu/people/faculty','.su-card__contents','h3','.su-card__contents',None,'h3 a'),
'mit':('https://www.eecs.mit.edu/role/faculty/','.people-entry','h5',':scope > p','.people-research a','h5 a'),
'princeton':('https://www.cs.princeton.edu/people/faculty','.custom_card__content','h3','.title,.position','.research_areas a','h3 a'),
'columbia':('https://www.cs.columbia.edu/people/faculty/','.faculty-row','.faculty-name','.faculty-title','.faculty-interests',None),
'uchicago':('https://cs.uchicago.edu/people/','.card--person','.card__title','.card__position',None,'.card__url'),
'duke':('https://cs.duke.edu/people/appointed-faculty/primary-faculty','.member-card','[role=heading]',None,None,'a'),
'northwestern':('https://www.mccormick.northwestern.edu/computer-science/people/faculty/','.faculty-info','h3','p:not(:has(.mail_link))',None,'h3 a'),
'cornell':('https://www.cs.cornell.edu/directory','.directory-card','.name','.position-titles','.card-content-group-subgroup:has(.label:-soup-contains("Research Areas")) .item-content','.view-full-profile a'),
'brown':('https://cs.brown.edu/people/faculty/','ul.profile-list li[id]:has(> ul > .profile-name)','.profile-name','.profile-title','.profile-areas span','.profile-link a'),
'dartmouth':('https://web.cs.dartmouth.edu/people','.profile-card:has(.profile-card__tag:-soup-contains("Faculty"))','.profile-card__name','.profile-card__appointments',None,'.profile-card__name'),
'jhu':('https://www.cs.jhu.edu/faculty/','.entity_info','.entity_name','.entity_title',None,'.entity_name a'),
'berkeley':('https://www2.eecs.berkeley.edu/Faculty/Lists/CS/faculty.html','.cc-image-list__item__content','h3','p strong:first-of-type','a[href*="/Research/Areas/"]','h3 a'),
'cmu':('https://csd.cmu.edu/people/faculty','tbody tr','td.views-field-field-first-name a','td.views-field-field-first-name',None,'td.views-field-field-first-name a'),
'caltech':('https://www.cms.caltech.edu/people','.person-teaser','.person-teaser__title','.person-teaser__job-title',None,'.person-teaser__link'),
'penn-math':('https://www.math.upenn.edu/people/standing-faculty','.people-list li.row-fluid','h2','.span6 h3','.span6 p','a:has(h2)'),
'berkeley-econ':('https://econ.berkeley.edu/people/faculty','.teaser_display','.display-name','.display-position','.research-fields span:not(.divider)','.display-name a'),
'duke-english':('https://english.duke.edu/people/faculty','article:has(.member-card)','.member-card [role=heading]','.h6',None,'.member-card a'),
'columbia-econ':('https://econ.columbia.edu/faculty/','.ts-faculty-main','.tshowcase-box-title','.tshowcase-single-position','.tshowcase-single-freehtml',None),
}
depts={'penn':'Computer and Information Science','penn-math':'Mathematics','mit':'Electrical Engineering and Computer Science','caltech':'Computing and Mathematical Sciences','columbia-econ':'Economics','berkeley-econ':'Economics','duke-english':'English'}
aliases={'penn':{'dinesh jayaraman':'penn-jayaraman','lyle ungar':'penn-ungar'},'michigan':{'rada mihalcea':'michigan-mihalcea'}}
def clean(s): return ' '.join(s.split())
def text(node): return clean(node.get_text(' ',strip=True)) if node else ''
def slug(s): return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip('-')
def name_order(s): return ' '.join(reversed(s.split(', '))) if ', ' in s else s
def args(src):
 return src.split('-',1)[0],depts.get(src,'Computer Science')
def record(school,dept,name,rank,topics,url):
 key=name.casefold()
 ident=aliases.get(school,{}).get(key,school+'-'+slug(name))
 return dict(id=ident,school=school,department=dept,name=name,academicTitle=rank,research=topics,source=url)
def topics_for(src,card,selector):
 if not selector:return []
 vals=[text(n) for n in card.select(selector)]
 if src=='columbia': vals=[w.strip() for x in vals for w in re.sub(r'^Interests:\s*','',x).split(',')]
 if src=='columbia-econ': vals=[w.strip() for x in vals if 'Fields:' in x for w in x.split('Fields:',1)[1].split(',')]
 if src=='brown': vals=[w.strip() for x in vals for w in x.split(',')]
 return list(dict.fromkeys(w for w in vals if 0<len(w)<=95))[:8]
def build_snapshot(input_folder, output_file):
    rows={}
    folder=Path(input_folder)
    for src,(url,cards,name_selector,rank_selector,topic_selector,link_selector) in spec.items():
     school,dept=args(src)
     for file in sorted(folder.glob(src+'*.html')):
      if file.stem!=src and not re.fullmatch(re.escape(src)+r'-page\d+',file.stem):continue
      soup=BeautifulSoup(file.read_bytes(),'html.parser')
      if src=='brown':
       for label in soup.select('.profile-name'):
        heading=label.find_previous('h2',class_='role-heading')
        if not heading or heading.get('id')!='primary':continue
        rank=text(label.find_next_sibling('li',class_='profile-title'))
        if not re.search(r'professor',rank,re.I) or re.search(r'emerit|visiting|adjunct',rank,re.I):continue
        area=label.find_next_sibling('li',class_='profile-areas')
        topics=[clean(x) for n in (area.select('span') if area else []) for x in text(n).split(',') if clean(x)][:8]
        links=label.find_next_sibling('li',class_='profile-link')
        profile=links.select_one('a[href^="/people/"]') if links else None
        row=record(school,dept,text(label),rank,topics,urljoin(url,profile['href']) if profile else url)
        rows[row['id']]=row
       continue
      for card in soup.select(cards):
       name=text(card.select_one(name_selector))
       if not name or len(name)>100 or len(name.split())<2:continue
       if src=='duke': rank='Primary faculty'
       elif src=='penn-math':
        title=card.select_one(rank_selector)
        rank=next((clean(x) for x in title.find_all(string=True,recursive=False) if clean(x)),'') if title else ''
       elif src=='stanford': rank=text(card).removeprefix(name).strip()
       elif src=='cmu':
        node=card.select_one(rank_selector)
        rank=next((clean(part) for part in node.strings if clean(part) and clean(part)!=name),'') if node else ''
       elif src in {'northwestern','duke-english'}: rank=next((text(n) for n in card.select(rank_selector) if re.search(r'professor',text(n),re.I)),'')
       else: rank=text(card.select_one(rank_selector))
       # Exclude retired, affiliate-only, visiting, and adjunct entries from this snapshot.
       if re.search(r'emerit|post.tenure|visiting|adjunct|affiliated faculty|by courtesy',rank,re.I):continue
       if not re.search(r'professor|primary faculty|standing faculty',rank,re.I):continue
       if src in {'cmu','columbia','berkeley-econ'}:name=name_order(name)
       if src=='caltech':
        if not re.search(r'comput|mathemat|data science',rank,re.I):continue
       if src=='harvard' and not re.search(r'comput|applied math|artificial intelligence',rank,re.I):continue
       if src=='cornell' and not re.search(r'comput|information science|statistic',rank,re.I):continue
       link=card.select_one(link_selector) if link_selector else None
       href=urljoin(url,link.get('href','')) if link else url
       if src=='caltech':href=href.split('?')[0]
       if src=='columbia-econ' and card.get('id'):href=url+'#'+card['id']
       if urlsplit(href).scheme!='https' or not urlsplit(href).hostname.endswith('.edu'):href=url
       row=record(school,dept,name,rank[:190],topics_for(src,card,topic_selector),href)
       rows.setdefault(row['id'],row)
    # Entries checked on official pages that use client-side directories or restrict downloads.
    manual = [
     ('michigan','Computer Science and Engineering','Rada Mihalcea','Professor',['Natural language processing'],'https://eecs.umich.edu/cse/about/women-in-cse.html'),
     ('michigan','Computer Science and Engineering','Barzan Mozafari','Associate Professor',['Data systems','Databases'],'https://cse.engin.umich.edu/people/faculty/core-cse-faculty/'),
     ('michigan','Computer Science and Engineering','Satish Narayanasamy','Professor',['Computer architecture','Program analysis'],'https://cse.engin.umich.edu/people/faculty/core-cse-faculty/'),
     ('michigan','Computer Science and Engineering','Max New','Assistant Professor',['Programming languages'],'https://cse.engin.umich.edu/people/faculty/core-cse-faculty/'),
     ('michigan','Computer Science and Engineering','Cyrus Omar','Associate Professor',['Programming tools'],'https://cse.engin.umich.edu/people/faculty/core-cse-faculty/'),
     ('yale','Computer Science','Arman Cohan','Assistant Professor',[],'https://engineering.yale.edu/research-and-faculty/faculty-directory'),
     ('yale','Computer Science','Ronald Coifman','Professor',[],'https://engineering.yale.edu/research-and-faculty/faculty-directory'),
     ('yale','Computer Science','Theodore Kim','Primary faculty',['Computing and the arts'],'https://c2.cs.yale.edu/people/primary-faculty'),
     ('ucla','Computer Science','Wei Wang','Professor and Department Chair',[],'https://www.cs.ucla.edu/'),
     ('ucla','Computer Science','Konstantinos Kallas','Professor',[],'https://www.cs.ucla.edu/'),
     ('ucla','Computer Science','Sandra Batista','Assistant Teaching Professor',[],'https://www.cs.ucla.edu/ucla-computer-science-welcomes-six-faculty-members-v1/'),
     ('vanderbilt','Computer Science','Jonathan Sprinkle','Professor and Department Chair',[],'https://engineering.vanderbilt.edu/departments/computer-science/'),
    ]
    for values in manual:
     row=record(*values)
     rows[row['id']]=row
    for row in sorted(rows.values(),key=lambda r:(r['school'],r['name'].casefold())):
     assert row['source'].startswith('https://') and row['academicTitle']
    out=sorted(rows.values(),key=lambda r:(r['school'],r['name'].casefold()))
    Path(output_file).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print(len(out), dict(sorted(Counter(row['school'] for row in out).items())))

if __name__ == '__main__':
    build_snapshot(*sys.argv[1:])
