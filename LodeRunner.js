/*     Lode Runner

Aluno 1: ?number ?name <-- mandatory to fill
Aluno 2: ?number ?name <-- mandatory to fill

Comentario:

O ficheiro "LodeRunner.js" tem de incluir, logo nas primeiras linhas,
um comentário inicial contendo: o nome e número dos dois alunos que
realizaram o projeto; indicação de quais as partes do trabalho que
foram feitas e das que não foram feitas (para facilitar uma correção
sem enganos); ainda possivelmente alertando para alguns aspetos da
implementação que possam ser menos óbvios para o avaliador.

01234567890123456789012345678901234567890123456789012345678901234567890123456789
 */

// GLOBAL VARIABLES

// tente não definir mais nenhuma variável global

let empty, hero, control;

// ACTORS

class Actor
{
    constructor(x, y, imageName)
    {
        this.x = x;
        this.y = y;
        this.imageName = imageName;
        this.show();
    }

    draw(x, y)
    {
        control.ctx.drawImage(GameImages[this.imageName],
            x * ACTOR_PIXELS_X, y * ACTOR_PIXELS_Y);
    }

    move(dx, dy)
    {
        this.hide();
        this.x += dx;
        this.y += dy;
        this.show();
    }
}

class PassiveActor extends Actor
{
    show()
    {
        control.gameState.world[this.x][this.y] = this;
        this.draw(this.x, this.y);
    }

    hide()
    {
        control.gameState.world[this.x][this.y] = empty;
        empty.draw(this.x, this.y);
    }
}

class ActiveActor extends Actor
{
    constructor(x, y, imageName)
    {
        super(x, y, imageName);
        this.time = 0; // timestamp used in the control of the animations
    }

    show()
    {
        control.gameState.worldActive[this.x][this.y] = this;
        this.draw(this.x, this.y);
    }

    hide()
    {
        control.gameState.worldActive[this.x][this.y] = empty;
        control.gameState.world[this.x][this.y].draw(this.x, this.y);
    }

    animation() {}
}

class Brick extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "brick");
    }
}

class Chimney extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "chimney");
    }
}

class Empty extends PassiveActor
{
    constructor()
    {
        super(-1, -1, "empty");
    }

    show() {}
    hide() {}
}

class Gold extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "gold");
    }
}

class Invalid extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "invalid");
    }
}

class Ladder extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "empty");
    }

    makeVisible()
    {
        this.imageName = "ladder";
        this.show();
    }
}

class Rope extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "rope");
    }
}

class Stone extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "stone");
    }
}

class Hero extends ActiveActor
{
    constructor(x, y)
    {
        super(x, y, "hero_runs_left");
    }

    animation()
    {
        let k = control.gameState.getKey();
        if (k == ' ')
        {
            alert('SHOOT');
            return;
        }
        else
            if (k != null)
            {
                let[dx, dy] = k;
                this.hide();
                this.x += dx;
                this.y += dy;
                this.show();
            }
    }
}

class Robot extends ActiveActor
{
    constructor(x, y)
    {
        super(x, y, "robot_runs_right");
        this.dx = 1;
        this.dy = 0;
    }
}

// GAME CONTROL

class GameControl
{
    constructor()
    {
        control = this;

        this.canvas = document.getElementById("canvas1");
        this.ctx = this.canvas.getContext("2d");
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.statesMachine = new StatesMachine();
        this.mainMenuState = new MainMenuState();
        this.gameState = new GameState();
        this.statesMachine.addState("Game", this.gameState);
        this.statesMachine.changeState("MainMenu", this.mainMenuState);
    }
}

// HTML FORM

function onLoad()
{
    // Asynchronously load the images an then run the game
    GameImages.loadAll(function ()
    {
        new GameControl();
    }
    );
    onCanvasLoad();
}

function onCanvasLoad()
{
    let canvas = document.getElementById("canvas1");
    let ctx = canvas.getContext("2d");

    canvas.width = 504;
    canvas.height = 272;

    canvas.style.width = (screen.width / 2.0) + "px";
    canvas.style.height = (screen.height / 2.0) + "px";
}

class StatesMachine
{

    constructor()
    {
        this.currentState = null;
        this.states = new Map();
        this.activeStates = new Map();
        this.readyToSwitch = false;
    }

    addState(name, state)
    {
        this.states.set(name, state);
    }

    changeState(name, state = null)
    {
        if (!this.states.has(name))
        {
            if (state == null)
                msg("Trying to change to null state: " + name);
            else
                this.addState(name, state);
        }

        let oldState = this.currentState;
        this.currentState = name;

        if (oldState != null)
            this.states.get(oldState).unloadEvents();

        if (this.activeStates.has(this.currentState))
        {
            this.states.get(this.currentState).loadEvents();
            this.states.get(this.currentState).onSwitch(oldState);
        }
        else
        {
            this.activeStates.set(this.currentState, this.states[this.currentState]);
            this.states.get(this.currentState).loadEvents();
            this.states.get(this.currentState).onCreate();
        }
    }

    deleteState(name)
    {
        if (!states.has(name))
            msg("Trying to delete a state that does not exist! error: " + name);

        this.states.get(name).onDestroy();
        this.states.delete(name);
    }
}

class State
{
    constructor() {}

    loadEvents() {}
    unloadEvents() {}

    onCreate() {}

    onSwitch(oldState) {}

    onDestroy() {}
}

class MainMenuState extends State
{
    constructor()
    {
        super();
    }

    onCreate()
    {
        this.showMainMenu();
    }

    onSwitch(oldState)
    {
        this.onCreate();
    }

    loadEvents()
    {
        document.getElementById("startBtn").addEventListener("click", this.initializeGame, false);
        document.getElementById("optionsBtn").addEventListener("click", this.showOptions, false);
        document.getElementById("creditsBtn").addEventListener("click", this.showMainMenu, false);
    }

    initializeGame()
    {
        document.getElementById("startBtn").style.display = 'none';
        document.getElementById("optionsBtn").style.display = 'none';
        control.statesMachine.changeState("Game");
    }

    showOptions()
    {
        document.getElementById("startBtn").style.display = 'none';
        document.getElementById("optionsBtn").style.display = 'none';
        document.getElementById("creditsBtn").style.display = 'block';
    }

    showMainMenu()
    {
        document.getElementById("startBtn").style.display = 'block';
        document.getElementById("optionsBtn").style.display = 'block';
        document.getElementById("creditsBtn").style.display = 'none';
    }
}

class GameState extends State
{

    constructor(statesMachine)
    {
        super(statesMachine);
    }

    loadEvents()
    {
        addEventListener("keydown", this.keyDownEvent, false);
        addEventListener("keyup", this.keyUpEvent, false);
        this.interval = setInterval(this.animationEvent, 1000 / ANIMATION_EVENTS_PER_SECOND);
    }

    unloadEvents()
    {
        removeEventListener("keydown", this.keyDownEvent, false);
        removeaddEventListener("keyup", this.keyUpEvent, false);
        clearInterval(this.interval);
    }

    onCreate()
    {
        this.key = 0;

        this.time = 0;

        empty = new Empty(); // only one empty actor needed

        this.world = this.createMatrix();
        this.worldActive = this.createMatrix();

        this.loadLevel(1);
        this.loadEvents();
    }

    createMatrix()
    { // stored by columns
        let matrix = new Array(WORLD_WIDTH);
        for (let x = 0; x < WORLD_WIDTH; x++)
        {
            let a = new Array(WORLD_HEIGHT);
            for (let y = 0; y < WORLD_HEIGHT; y++)
                a[y] = empty;
            matrix[x] = a;
        }
        return matrix;
    }

    loadLevel(level)
    {
        if (level < 1 || level > MAPS.length)
            fatalError("Invalid level " + level)
            let map = MAPS[level - 1]; // -1 because levels start at 1
        for (let x = 0; x < WORLD_WIDTH; x++)
            for (let y = 0; y < WORLD_HEIGHT; y++)
            {
                // x/y reversed because map stored by lines
                GameFactory.actorFromCode(map[y][x], x, y);
            }
    }

    getKey()
    {
        let k = control.gameState.key;
        control.gameState.key = 0;
        switch (k)
        {
        case 37:
        case 79:
        case 74:
            return [-1, 0]; //  LEFT, O, J
        case 38:
        case 81:
        case 73:
            return [0, -1]; //    UP, Q, I
        case 39:
        case 80:
        case 76:
            return [1, 0]; // RIGHT, P, L
        case 40:
        case 65:
        case 75:
            return [0, 1]; //  DOWN, A, K
        case 0:
            return null;
        default:
            return String.fromCharCode(k);
            // http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
        };
    }

    animationEvent()
    {
        control.gameState.time++;
        for (let x = 0; x < WORLD_WIDTH; x++)
            for (let y = 0; y < WORLD_HEIGHT; y++)
            {
                let a = control.gameState.worldActive[x][y];
                if (a.time < control.gameState.time)
                {
                    a.time = control.gameState.time;
                    a.animation();
                }
            }
    }

    keyDownEvent(k)
    {
        control.gameState.key = k.keyCode;
    }

    keyUpEvent(k) {}
}
