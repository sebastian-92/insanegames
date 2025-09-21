const resultsId = 'results'
function renderGames(results) {
    var gameHTML = ''
    console.log(results)
    results.result.forEach(item => {
        if (item.recordType == 'game'){
            gameHTML += `
            <a href="play.html?game=${item.slug}">
            <img class="game-cover" loading="lazy" src="https://imgs.crazygames.com/${item.cover}" width=20% height=auto />
            </a>
            `
        }
    document.getElementById('results').innerHTML = gameHTML;
    })
}
async function search(game){
    const res = await fetch(`https://api.crazygames.com/v4/en_US/search?q=${encodeURIComponent(game)}&limit=100&device=desktop&includeTopGames=true`);
    const data = await res.json();
    renderGames(data);
}