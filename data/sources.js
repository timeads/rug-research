// Search portals. "{q}" is replaced with your search terms (URL-encoded).
// Where a site's own search URL format isn't stable, a Google site: search is used instead.
window.RUG_SOURCES = [
  { group: "Winterthur", name: "Museum collection", url: "https://www.google.com/search?q=site%3Amuseumcollection.winterthur.org+{q}", home: "https://museumcollection.winterthur.org/" },
  { group: "Winterthur", name: "Library catalog", url: "https://www.google.com/search?q=site%3Alibrary.winterthur.org+{q}", home: "https://library.winterthur.org/" },
  { group: "Winterthur", name: "Trade catalogs on Internet Archive", url: "https://archive.org/search?query={q}+AND+contributor%3A%28Winterthur%29", home: "https://archive.org/search?query=contributor%3A%28Winterthur%29" },
  { group: "Hagley", name: "Digital Archives (images)", url: "https://www.google.com/search?q=site%3Adigital.hagley.org+{q}", home: "https://digital.hagley.org/" },
  { group: "Hagley", name: "Finding aids (manuscripts)", url: "https://findingaids.hagley.org/search?q[]={q}", home: "https://findingaids.hagley.org/" },
  { group: "Hagley", name: "Research home", url: "https://www.google.com/search?q=site%3Ahagley.org+{q}", home: "https://www.hagley.org/research" },
  { group: "Museums", name: "The Met", url: "https://www.metmuseum.org/art/collection/search?q={q}", home: "https://www.metmuseum.org/art/collection" },
  { group: "Museums", name: "Cooper Hewitt", url: "https://collection.cooperhewitt.org/search/collection?query={q}", home: "https://collection.cooperhewitt.org/" },
  { group: "Museums", name: "Smithsonian collections", url: "https://collections.si.edu/search/results.htm?q={q}", home: "https://collections.si.edu/" },
  { group: "Museums", name: "V&A", url: "https://collections.vam.ac.uk/search/?q={q}", home: "https://collections.vam.ac.uk/" },
  { group: "Museums", name: "Henry Ford (Ford Museum)", url: "https://www.thehenryford.org/collections-and-research/digital-collections/search-results#advancedSearch=1&tab=artifact-results&s.0={q}", home: "https://www.thehenryford.org/collections-and-research/digital-collections/" },
  { group: "Books & texts", name: "HathiTrust", url: "https://babel.hathitrust.org/cgi/ls?q1={q};anyall1=phrase;lmt=all", home: "https://www.hathitrust.org/" },
  { group: "Books & texts", name: "Internet Archive", url: "https://archive.org/search?query={q}", home: "https://archive.org/" },
  { group: "Books & texts", name: "Google Books", url: "https://www.google.com/search?tbm=bks&q={q}", home: "https://books.google.com/" },
  { group: "Books & texts", name: "WorldCat", url: "https://search.worldcat.org/search?q={q}", home: "https://search.worldcat.org/" },
  { group: "Books & texts", name: "Library of Congress", url: "https://www.loc.gov/search/?q={q}", home: "https://www.loc.gov/" },
  { group: "Books & texts", name: "DPLA", url: "https://dp.la/search?q={q}", home: "https://dp.la/" },
  { group: "Tufting & industry", name: "Google Patents", url: "https://patents.google.com/?q=%22{q}%22", home: "https://patents.google.com/" },
  { group: "Tufting & industry", name: "Digital Library of Georgia", url: "https://dlg.usg.edu/search?q={q}", home: "https://dlg.usg.edu/" },
  { group: "Tufting & industry", name: "Bandy Heritage Center (Dalton)", url: "https://bandyheritagecenter.pastperfectonline.com/search?search_criteria={q}", home: "https://bandyheritagecenter.pastperfectonline.com/" },
  { group: "Tufting & industry", name: "Chronicling America (newspapers)", url: "https://chroniclingamerica.loc.gov/search/pages/results/?andtext={q}", home: "https://chroniclingamerica.loc.gov/" }
];
