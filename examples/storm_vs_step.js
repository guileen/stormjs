function loadArticle(name, _) {
  var markdown = Git.readFile(path.join("articles", name + ".markdown"), _);
  props = markdownPreParse(markdown);
  props.name = name;
  var author = loadAuthor(props.author, _);
  props.author = author;
  return props;
}
