const sections = [
 ["Hem","Överblick","/"], ["Kalender","Familjens vecka","/kalender"], ["Check-in","Var är jag?","/check-in"],
 ["Uppgifter","Ansvar & XP","/uppgifter"], ["Hjälp","Hjälp i familjen","/hjalp"], ["Listor","Gemensamt","/listor"],
 ["Önskelistor","Presenter","/onskelistor"], ["Budget","För föräldrar","/budget"], ["Mina pengar","Min sparplan","/sparande"],
 ["Chat","Familjen","/chat"], ["Notiser","Det senaste","/notiser"], ["Galleri","Minnen","/galleri"],
] as const;
export function navigationForRole(role?:string){
 return sections.filter(([, ,href])=>(href!=="/budget"||role==="admin"||role==="förälder")&&(href!=="/sparande"||role==="barn"));
}
