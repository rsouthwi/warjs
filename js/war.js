/*jshint strict:false */

const suits = {
	'H': {
		name: 'hearts',
		color: 'red',
		symbol: '\u2665'},
	'S': {
		name: 'spades',
		color: 'black',
		symbol: '\u2660'},
	'D': {
		name: 'diamonds',
		color: 'red',
		symbol: '\u2666'},
	'C': {
		name: 'clubs',
		color: 'black',
		symbol: '\u2663'}
};

const deckValue = {
	'J': 11,
	'Q': 12,
	'K': 13,
	'A': 14
	};
for (let i=2; i<11; i++) {
	deckValue[i.toString()] = i;
}

function PlayerEvent(player){
  this.player = player;
  this.callbacks = [];
}
PlayerEvent.prototype.registerCallback = function(callback){
  this.callbacks.push(callback);
}

function PlayerOutDispatcher() {
	this.players = {};
}
PlayerOutDispatcher.prototype.registerPlayer = function(player) {
	let playerEvent = new PlayerEvent(player);
	this.players[player.name] = playerEvent;
}
PlayerOutDispatcher.prototype.dispatchEvent = function(player, eventArgs) {
	this.players[player.name].callbacks.forEach(function(callback) {
		callback(eventArgs);
	})
}
PlayerOutDispatcher.prototype.watchPlayer = function(player, callback) {
	this.players[player.name].registerCallback(callback);
}
var playerOutDispatcher = new PlayerOutDispatcher();

function CardWatcher() {
	this.players = {};
}
CardWatcher.prototype.willPlayCards = function(player) {
	let playerEvent = new PlayerEvent(player);
	this.players[player.name] = playerEvent;
}
CardWatcher.prototype.playsCard = function(player, card) {
	this.players[player.name].callbacks.forEach(function(callback) {
		callback(player, card);
	})
}
CardWatcher.prototype.addEventListener = function(player, callback) {
	this.players[player.name].registerCallback(callback);
}
var cardWatcher = new CardWatcher();


class Player {
	constructor(name) {
		this.name = name;
		this.drawPile = [];
		this.discardPile = [];
		this.human = false;
		this._active = true;
		this._inWar = false;
		this._warCardsToPlay = 0;
		this._canPlayThisRound = true;
		playerOutDispatcher.registerPlayer(this);
		cardWatcher.willPlayCards(this);
		let thisPlayer = this;
	}

	set isActive(stateChange) {
		if (typeof stateChange === "boolean" && this._active !== stateChange) {
			this._active = stateChange;
			if (!this._active) {
				playerOutDispatcher.dispatchEvent(this);
			}
		}
	}
	get isActive() {
		this._active = (this.drawPile.length + this.discardPile.length) > 0;
		return this._active;
	}

	set canPlayThisRound(stateChange) {
		this._canPlayThisRound = stateChange;
	}
	get canPlayThisRound() {
		return this._canPlayThisRound;
	}

	playCard() {
		if (!this.isActive) {
			throw this.name + " is no longer playing."
		}
		if (!this.canPlayThisRound)  return;
		if (this.drawPile.length === 0) {
			shuffleCards(this.discardPile);
			this.drawPile = this.discardPile;
			this.discardPile = [];
		}

		let card = this.drawPile.pop();
		
		if (!this._inWar) {
			this.canPlayThisRound = false;
			cardWatcher.playsCard(this, card)
		} else {
			return card
		}
	}

	playWarCards(numberOfCards) {
		this._inWar = true;
		this.canPlayThisRound = true;
		let warSpoils = []
		for (let i=1; i < numberOfCards; i++) {
			warSpoils.push(this.playCard());  // face down
		}
		this._inWar = false;
		return warSpoils;
	}

	pickUpCards(cardsWon) {
		this.discardPile = [...this.discardPile, ...cardsWon]
	}
}

function newDeck() {
	class Card {
		constructor(value, suit)  {
			this.value = deckValue[value];
			this.deckValue = value;
			this.suit = suit;
			this.name = value + " of " + this.suit.name;
		} 
	}
	let deckOfCards = [];

	
	for (let suit in suits) {
		for (let value in deckValue) {
			let card = new Card(value, suits[suit]);
			deckOfCards.push(card);
		}
	}
	return deckOfCards;
}

function shuffleCards(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
} 

class GameOfWar {
	constructor(players) {
		this.players = players || [];
		this.activePlayers = [];
		this.deck = [];
		this.whoseTurn;
		this.hasYetToPlay = [];
		this.gameStarted = false;
		this.round = 0;
	}

	resetRound() {
		this.spoils = []; // these are the cards to be collected by the winner
		this.cardsPlayed = {};	
		this.round ++;

		// reset who is active
		this.activePlayers = [];
		for (let i=0; i<this.players.length; i++) {
			if (this.players[i].isActive) {
				this.activePlayers.push(this.players[i]);
				this.canPlayCard(i);
			}
		}	
		this.hasYetToPlay = this.activePlayers.slice();
	}

	allEqualNumberOfCards() {
		return this.players.every( v => v.drawPile.length === this.players[0].drawPile.length );
	}

	createPlayers() {
		let game = this;
		let numberOfPlayers = window.prompt("Enter Number of Players", 2)
		let integerOfPlayers = parseInt(numberOfPlayers, 10);
		if (!Number.isInteger(integerOfPlayers) ||
			integerOfPlayers < 2 ||
			integerOfPlayers > 13) {
			return window.alert(numberOfPlayers + " is an invalid number of players.  Choose a number from 2 to 13.")
		}
		for (let i=0; i < integerOfPlayers; i++) {
			let playerName = window.prompt("Enter the Player's name...", "Player " + (i+1));
			let newPlayer = new Player(playerName);
			newPlayer.human = window.confirm("Is this Player a human?");
			this.players.push(newPlayer);
			newPlayer.index = this.players.indexOf(newPlayer);

			playerOutDispatcher.watchPlayer(newPlayer, function() {
				let index = game.activePlayers.indexOf(newPlayer);
				game.activePlayers.splice(index, 1);
			});
			cardWatcher.addEventListener(newPlayer, function(player, card) {
				let index = game.players.indexOf(newPlayer);
				game.cardsPlayed[index] = card;
				game.hasPlayedCard(index);
				if (Object.getOwnPropertyNames(game.cardsPlayed).length === game.activePlayers.length) {
					console.log('everyone has played');
					game.evaluateRound();
				}

			})
		}		
	}

	_getOrCreateStyle() {
		let styleSelector = 'generatedStyle';
		if (!document.getElementById(styleSelector)) {
			let style = document.createElement('style');
			style.type = 'text/css';
			style.id = styleSelector;
			document.getElementsByTagName('head')[0].appendChild(style);			
		}
		return document.getElementById(styleSelector);
	}

	_getOrCreateGameArea() {
		let gaSelector = 'gameArea';
		let gameArea = document.getElementsByClassName(gaSelector);

		if (gameArea.length < 1) {
			gameArea = document.createElement('div');
			gameArea.className = gaSelector;
			let body = document.getElementsByTagName('body')[0];

			// let style = this._getOrCreateStyle();
			// style.innerHTML = '.' + gaSelector + ' { border: 1px solid #999999; display: flex }';
			body.appendChild(gameArea);
		}  else {
			gameArea = gameArea[0];
		}
		return gameArea;
	}

	_createPlayerBoxes() {
		let gameArea = this._getOrCreateGameArea();
		for (let i=0; i<this.players.length; i++) {
			let playerBox = document.createElement('div');
			playerBox.id = "player_"+ i;
			playerBox.className = "playerBox";

			let playAreaSpacer = document.createElement('div');
			playAreaSpacer.className = "playAreaSpacer";
			playerBox.appendChild(playAreaSpacer);

			let playerName = document.createElement('div');
			playerName.className = "playerName";
			playerName.innerHTML = this.players[i].name;
			playerBox.appendChild(playerName);

			let drawPile = document.createElement('div');
			drawPile.className = "drawPile";
			playerBox.appendChild(drawPile);
			if (this.players[i].drawPile.length > 0) {
				let cardBack = document.createElement('div');
				cardBack.className = "card back";
				drawPile.appendChild(cardBack);
			}

			let discardPile = document.createElement('div');
			discardPile.className = "discardPile";
			playerBox.appendChild(discardPile);

			gameArea.appendChild(playerBox);
		}
	}

	createBoard() {
		let gameArea = this._getOrCreateGameArea();
		gameArea.style.width = this.players.length * 160 + 'px';
		this._createPlayerBoxes();
	}

	startGame() {
		if (this.players.length == 0) {
			this.createPlayers();
		}
		let randomPlayerIndex = Math.floor(Math.random() * this.players.length);
		this.whoseTurn = this.players[randomPlayerIndex];
		this.deck = newDeck();
		shuffleCards(this.deck);
		this.dealDeck();
		this.hasYetToPlay = this.players.slice();
		this.createBoard();
		this.resetRound();
	}

	nextPlayer() {
		let nextPlayerIndex = this.players.indexOf(this.whoseTurn) + 1;

		for (let i=0; i<this.players.length; i++) {
			if (this.players.indexOf(this.whoseTurn) === nextPlayerIndex && this.gameStarted)  {
				this.gameOver(this.whoseTurn);
			}
			if (nextPlayerIndex === this.players.length) {
				nextPlayerIndex = 0;
			}
			if (!this.gameStarted || this.players[nextPlayerIndex].isActive)  {
				this.whoseTurn = this.players[nextPlayerIndex];
				break;
			}
			nextPlayerIndex++;
		}
	}

	dealDeck() {
		for (let i=0; i < this.deck.length;  i++)  {
			if (this.allEqualNumberOfCards() && this.deck.length-i < this.players.length)  {
				// discard any extra cards that would cause one player to have more than others
				break;
			}
			this.whoseTurn.drawPile.push(this.deck[i]);
			this.nextPlayer();
		}
		this.gameStarted = true;
	}

	_playerPlay(playerIndex) {
		let game = this;
		return function() {
			game.players[playerIndex].playCard();
		}
	}

	_displayCardPlayed(playerIndex) {

	// 		<div class="card face red">
	// 			<p class="value">10</p>
	// 			<span class="suit">♦</span>
	//		</div>

		let UI_playerDiv = document.getElementById('player_' + playerIndex);
		let UI_playArea = UI_playerDiv.querySelector('.playAreaSpacer');
		let card = this.cardsPlayed[playerIndex];
		
		let UI_card = document.createElement('div');
		UI_card.classList.add('card');
		UI_card.classList.add('face');
		UI_card.classList.add(card.suit.color);
		
		let UI_cardValue = document.createElement('p');
		UI_cardValue.classList.add('value');
		UI_cardValue.innerHTML =  card.deckValue;
		UI_card.appendChild(UI_cardValue);

		let UI_cardSuit = document.createElement('span');
		UI_cardSuit.classList.add('suit');
		UI_cardSuit.innerHTML = card.suit.symbol;
		UI_card.appendChild(UI_cardSuit);

		UI_playArea.appendChild(UI_card);
	}

	hasPlayedCard(playerIndex) {
		this.hasYetToPlay.splice(playerIndex, 1);
		let UI_playerDiv = document.getElementById('player_' + playerIndex);
		let UI_drawPileDiv = UI_playerDiv.querySelector('.drawPile');
		let game = this; 

		UI_drawPileDiv.removeEventListener('click', this._playerPlay(playerIndex));
		this._displayCardPlayed(playerIndex);
		UI_drawPileDiv.classList.add('inactive');
	}

	canPlayCard(playerIndex) {
		let UI_playerDiv = document.getElementById('player_' + playerIndex);
		let UI_drawPileDiv = UI_playerDiv.querySelector('.drawPile');
		let game = this;

		// this needs a little time to fire or else it gets confused with the hasPlayedCard eventListener
		setTimeout( function() {
			UI_drawPileDiv.addEventListener("click", game._playerPlay(playerIndex));
			UI_drawPileDiv.classList.remove('inactive');
			game.players[playerIndex].canPlayThisRound = true;
		}, 100)
	}

	conductWar(players) {
		console.log("THIS MEANS WAR!!!");
		this.hasYetToPlay = players.slice();
		this.activePlayers = players.slice();
		this.cardsPlayed = {};
		let cardThreshold = 4;
		let game = this;
		players.forEach(function(player) {
			console.log(player);
			let playerCards = player.discardPile.length + player.drawPile.length;
			if (playerCards < cardThreshold) {
				cardThreshold = playerCards;
			}
			game.canPlayCard(player.index);
		});
		players.forEach(function(player) {
			let warSpoils = player.playWarCards(cardThreshold);
			console.log("spoils from " + player.name + ":")
			console.log(warSpoils);
			game.spoils.push(...warSpoils);
			player.playCard();
		});
	}

	_playedTwo() {
		for (let card in this.cardsPlayed) {
			if (this.cardsPlayed[card].value === 2) return true;
		}
		return false;
	}

	evaluateRound() {
		let winners = [];
		let highestValue = 0;

		for (let card in this.cardsPlayed) {
			if (this.cardsPlayed[card].value > highestValue) {
				highestValue = this.cardsPlayed[card].value;
			}
		}

		// check if a 2 was played with an A
		if (highestValue === 14 && this._playedTwo()) { 
			highestValue = 2;
		}

		// check if we have multiple same high cards and add the cards to this.spoils
		for (let playerIndex in this.cardsPlayed) {
			if (this.cardsPlayed[playerIndex].value === highestValue)  {
				winners.push(this.players[playerIndex]);
			}
			this.spoils.push(this.cardsPlayed[playerIndex]);
		}

		if (winners.length > 1)  {
			this.conductWar(winners);
		} else {
			this.collectSpoils(winners[0]);
		}
	}

	collectSpoils(player) {
		let nonWinners = "";
		let losingCards = "";
		for (let loser in this.cardsPlayed) {
			if (player !== this.players[loser]) {
				nonWinners += this.players[loser].name + " ";
				losingCards += this.cardsPlayed[loser].name + " ";
			}
		}
		console.log("the winner: ")
		console.log(player.name)
		console.log("with card: ")
		console.log(this.cardsPlayed[player.index].name)
		console.log("beat players: " + nonWinners)
		console.log("with these rags: " + losingCards)


		player.pickUpCards(this.spoils);
		this.nextRound();
	}

	nextRound() {
		this.resetRound(); 
		
		if (this.activePlayers.length === 1) {
			this.gameOver(this.activePlayers[0]);
		}
	}

	gameOver(winner) {
		console.log('the game is over.  the winner is ' + winner.name);
		this.gameStarted = false;
	}
}

var newGame = function() {
	window.g = new GameOfWar();
	g.startGame();
}