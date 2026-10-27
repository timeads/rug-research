// Search portals. "{q}" is replaced with your search terms (URL-encoded).
// Each site's own search is used where its address was confirmed (checked Oct 2026 with scripts/probe-apis.mjs).
// Otherwise a Google site: search ("via: Google"), which only finds what Google has indexed, or, with
// "copy: true", the site's home page with your search words copied to paste in.
window.RUG_SOURCES = [
  { group: "Winterthur", name: "Museum collection", url: "https://museumcollection.winterthur.org/search-results?s={q}", home: "https://museumcollection.winterthur.org/" },
  { group: "Winterthur", name: "Library digital collections", url: "https://digitalcollections.winterthur.org/documents/search?search={q}", home: "https://digitalcollections.winterthur.org/" },
  { group: "Winterthur", name: "Library catalog (WinterCat)", url: "https://library.winterthur.org/", home: "https://library.winterthur.org/", copy: true },
  { group: "Winterthur", name: "Trade catalogs on Internet Archive", url: "https://archive.org/search?query={q}+AND+contributor%3A%28Winterthur%29", home: "https://archive.org/search?query=contributor%3A%28Winterthur%29" },
  // Hagley's new site (2024) has a different search address and checks every visitor, so the link opens the site and copies your words to paste.
  { group: "Hagley", name: "Digital Archives (images)", url: "https://digital.hagley.org/", home: "https://digital.hagley.org/", copy: true },
  { group: "Hagley", name: "Finding aids (manuscripts)", url: "https://findingaids.hagley.org/search?q[]={q}", home: "https://findingaids.hagley.org/" },
  { group: "Hagley", name: "Research home", url: "https://www.google.com/search?q=site%3Ahagley.org+{q}", home: "https://www.hagley.org/research", via: "Google" },
  { group: "Museums", name: "The Met", url: "https://www.metmuseum.org/art/collection/search?q={q}", home: "https://www.metmuseum.org/art/collection" },
  { group: "Museums", name: "Cooper Hewitt", url: "https://collection.cooperhewitt.org/search/collection?query={q}", home: "https://collection.cooperhewitt.org/" },
  { group: "Museums", name: "Smithsonian collections", url: "https://collections.si.edu/search/results.htm?q={q}", home: "https://collections.si.edu/" },
  { group: "Museums", name: "V&A", url: "https://collections.vam.ac.uk/search/?q={q}", home: "https://collections.vam.ac.uk/" },
  { group: "Museums", name: "Henry Ford (Ford Museum)", url: "https://www.thehenryford.org/search?q={q}", home: "https://www.thehenryford.org/collections-and-research/digital-collections/" },
  { group: "Books & texts", name: "HathiTrust", url: "https://babel.hathitrust.org/cgi/ls?q1={q};anyall1=phrase;lmt=all", home: "https://www.hathitrust.org/" },
  { group: "Books & texts", name: "Internet Archive", url: "https://archive.org/search?query={q}", home: "https://archive.org/" },
  { group: "Books & texts", name: "Google Books", url: "https://www.google.com/search?tbm=bks&q={q}", home: "https://books.google.com/" },
  { group: "Books & texts", name: "WorldCat", url: "https://search.worldcat.org/search?q={q}", home: "https://search.worldcat.org/" },
  { group: "Books & texts", name: "Library of Congress", url: "https://www.loc.gov/search/?q={q}", home: "https://www.loc.gov/" },
  { group: "Books & texts", name: "DPLA", url: "https://dp.la/search?q={q}", home: "https://dp.la/" },
  { group: "Early tufted & pile textiles", name: "Historic Deerfield", url: "https://www.google.com/search?q=site%3Ahistoric-deerfield.org+{q}", home: "https://www.historic-deerfield.org/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "Connecticut Historical Society", url: "https://www.google.com/search?q=site%3Aemuseum.chs.org+{q}", home: "https://emuseum.chs.org/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "American Folk Art Museum", url: "https://www.google.com/search?q=site%3Acollection.folkartmuseum.org+{q}", home: "https://collection.folkartmuseum.org/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "Historic New England", url: "https://www.google.com/search?q=site%3Ahistoricnewengland.org+{q}", home: "https://www.historicnewengland.org/explore/collections-access/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "Wadsworth Atheneum", url: "https://www.google.com/search?q=site%3Athewadsworth.org+{q}", home: "https://www.thewadsworth.org/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "MFA Boston", url: "https://collections.mfa.org/search/objects/*/{q}", home: "https://collections.mfa.org/" },
  { group: "Early tufted & pile textiles", name: "MFA Houston / Bayou Bend", url: "https://www.google.com/search?q=site%3Aemuseum.mfah.org+{q}", home: "https://emuseum.mfah.org/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "LACMA", url: "https://www.google.com/search?q=site%3Acollections.lacma.org+{q}", home: "https://collections.lacma.org/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "Shelburne Museum", url: "https://www.google.com/search?q=site%3Ashelburnemuseum.org+{q}", home: "https://shelburnemuseum.org/collection/textiles/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "DAR Museum", url: "https://www.google.com/search?q=DAR+Museum+{q}", home: "https://www.dar.org/museum", via: "Google" },
  { group: "Early tufted & pile textiles", name: "Colonial Williamsburg", url: "https://www.google.com/search?q=site%3Aemuseum.history.org+{q}", home: "https://emuseum.history.org/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "Old Sturbridge Village", url: "https://www.google.com/search?q=site%3Aosv.org+{q}", home: "https://www.osv.org/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "Georgia Museum of Art", url: "https://www.google.com/search?q=site%3Ageorgiamuseum.org+{q}", home: "https://georgiamuseum.org/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "Atlanta History Center", url: "https://www.google.com/search?q=site%3Aatlantahistorycenter.com+{q}", home: "https://www.atlantahistorycenter.com/", via: "Google" },
  { group: "Early tufted & pile textiles", name: "Vanishing Georgia (photos)", url: "https://www.google.com/search?q=%22Vanishing+Georgia%22+{q}", home: "https://www.sos.ga.gov/georgia-archives", via: "Google" },
  { group: "Tufting & industry", name: "Google Patents", url: "https://patents.google.com/?q=%22{q}%22", home: "https://patents.google.com/" },
  { group: "Tufting & industry", name: "Digital Library of Georgia", url: "https://dlg.usg.edu/search?q={q}", home: "https://dlg.usg.edu/" },
  { group: "Tufting & industry", name: "Bandy Heritage Center (Dalton)", url: "https://bandyheritagecenter.pastperfectonline.com/search?search_criteria={q}", home: "https://bandyheritagecenter.pastperfectonline.com/" },
  { group: "Tufting & industry", name: "Chronicling America (newspapers)", url: "https://www.loc.gov/collections/chronicling-america/?q={q}", home: "https://www.loc.gov/collections/chronicling-america/" }
];
