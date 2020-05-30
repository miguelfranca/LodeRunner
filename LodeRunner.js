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
const SCORE_PER_GOLD = 100;
const RESPAWN_TIME_BRICK = 8 * ANIMATION_EVENTS_PER_SECOND;
const RESPAWN_TIME_ROBOT = 1 * ANIMATION_EVENTS_PER_SECOND;
const HERO_SHOOT_ANIM = 500;
const ROBOT_DUMB_ANIM = 1000;

const directions =
{
    LEFT: "left",
    RIGHT: "right",
    UP: "up",
    DOWN: "down"
}

// tente não definir mais nenhuma variável global

let empty, hero, control;

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

    clearCanvas()
    {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

class Animation
{
    constructor(images)
    {
        this.images = images;
        this.currentImage = 0;
    }

    step()
    {
        if (this.currentImage > this.images.length - 1)
            this.currentImage = 0;

        return this.images[this.currentImage++];
    }
}

class ActorEvent
{
    constructor(prev, cur, func, obj)
    {
        this.previousBlockFunc = prev;
        this.currentBlockFunc = cur;

        this.previousBlock = empty;
        this.currentBlock = empty;

        this.func = func;
        this.obj = obj;
    }

    check(x, y)
    {
        this.previousBlock = this.currentBlock;
        this.currentBlock = control.gameState.getBehind(x, y);

        if (this.previousBlock == null || this.currentBlock == null)
            return false;

        if (this.previousBlockFunc(this.previousBlock) &&
            this.currentBlockFunc(this.currentBlock))
        {
            this.func(this.obj);
            return true;
        }
        else
            return false;
    }
}

// ACTORS

class Actor
{
    constructor(x, y, imageName)
    {
        this.time = 0; // timestamp used in the control of the animations
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

    isBoundary()
    {
        return false;
    } //o metodo esta aqui para garantir a possibilidade de que, no futuro,
    //possam haver atores diferentes que imponham restricoes de passagem ao heroi
    isClimbable()
    {
        return false;
    }
    isEmpty()
    {
        return false;
    }

    animation() {}

    isFellable()
    {
        return false;
    }
}

class PassiveActor extends Actor
{
    constructor(x, y, imageName)
    {
        super(x, y, imageName);
    }
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

    isBreakable()
    {
        return false;
    }
    isGrabable()
    {
        return false;
    }
    isItem()
    {
        return false;
    }
    isVisible()
    {
        return true;
    }
}

class ActiveActor extends Actor
{
    constructor(x, y, imageName)
    {
        super(x, y, imageName);

        this.climbingAnimation = null;
        this.moveDirection = directions.LEFT;

        this.transitions = [
            this.climbTrans = new ActorEvent(function (x)
                {
                    return true;
                },
                    function (x)
                {
                    return x.isClimbable() && x.isVisible();
                },
                    this.climb,
                    this),

            this.leaveClimb = new ActorEvent(function (x)
                {
                    return x.isClimbable();
                },
                    function (x)
                {
                    return x.isEmpty();
                },
                    this.lclimb,
                    this),

            this.runningTrans = new ActorEvent(function (x)
                {
                    return x.isEmpty() || x.isGrabable() || x.isItem();
                },
                    function (x)
                {
                    return x.isEmpty() || !x.isVisible();
                },
                    this.run,
                    this),

            this.grabTrans = new ActorEvent(function (x)
                {
                    return true;
                },
                    function (x)
                {
                    return x.isGrabable();
                },
                    this.grab,
                    this)
        ]
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

    die()
    {
        this.hide();
    }

    update(dx, dy)
    {
        this.hide();
        this.updatePos(dx, dy);
        this.show();
    }

    updateImg()
    {
        this.hide();
        this.show();
    }

    updatePos(dx, dy)
    {
        this.x += dx;
        this.y += dy;
    }

    move(dx, dy)
    {
        let aux =
            (this.moveDirection === directions.RIGHT && dx < 0 || this.moveDirection === directions.LEFT && dx > 0);
        //fica true caso ele queira mudar de direcao

        // else if(dy > 0)
        //     this.moveDirection = directions.DOWN;
        // else if(dy < 0)
        //     this.moveDirection = directions.UP;
        /*if (aux){
        if (dx > 0)
        this.moveDirection = directions.RIGHT;
        else
        this.moveDirection = directions.LEFT;

        this.run(this);
        this.updateImg();
        return;
        }*/

        if (dx > 0)
            this.moveDirection = directions.RIGHT;
        else if (dx < 0)
            this.moveDirection = directions.LEFT;

        this.checkTransitions(dx, dy);

        if (aux)
        {
            let current = control.gameState.getBehind(this.x, this.y);

            if (current.isEmpty())
                this.run(this);

            if (current.isGrabable())
                this.grab(this);

            if (!current.isClimbable())
                this.updateImg();
        }
        else
            this.tryToMove(dx, dy);
    }

    tryToMove(dx, dy)
    {
        let next = control.gameState.get(this.x + dx, this.y + dy);
        let current = control.gameState.getBehind(this.x, this.y);

        if ((dy < 0 && !current.isClimbable()))
            return;

        if (!next.isBoundary() && (current.isVisible() || dy >= 0))
        {
            this.hide();
            if (!this.isFalling())
                this.updatePos(dx, dy);

            this.grabItem();

            if (this.isFalling())
                this.fall();

            this.show();
        }
    }

    checkTransitions(dx, dy)
    {
        for (let i = 0; i < this.transitions.length; ++i)
        {
            if (this.transitions[i].check(this.x + dx, this.y + dy))
                break;
        }
    }

    grabItem()
    {
        let aux = control.gameState.world[this.x][this.y];
        if (aux.isItem())
        {
            aux.hide();
            this.show();
            return true;
        }
        return false;
    }

    isFalling()
    {
        let behind = control.gameState.getBehind(this.x, this.y);
        let atFeet = control.gameState.get(this.x, this.y + 1);

        return !behind.isGrabable() && atFeet.isFellable() && !atFeet.isClimbable() && !behind.isClimbable();
    }

    animation()
    {
        if (this.isFalling())
        {
            if (this.time % 3 == 0) //serve para atrasar o movimento de queda
                this.update(0, 1);

            this.falling = true;
        }
        if (this.falling && !this.isFalling())
        { // stopped falling (is grounded)
            let behind = control.gameState.getBehind(this.x, this.y);

            if (!behind.isGrabable())
                this.run(this);
            else
                this.grab(this);

            this.grabItem();
            this.updateImg();

            this.falling = false;
        }
    }
}

class Hero extends ActiveActor
{
    constructor(x, y)
    {
        super(x, y, "hero_runs_left");
        this.numberOfItems = 0;

        this.climbingAnimation = new Animation(["hero_on_ladder_left", "hero_on_ladder_right"]);
    }

    climb(obj)
    {
        obj.imageName = obj.climbingAnimation.step();
    }

    lclimb(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "hero_runs_left";
        else
            obj.imageName = "hero_runs_right";
    }

    grab(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "hero_on_rope_left";
        else
            obj.imageName = "hero_on_rope_right";

    }

    lgrab(obj)
    {
        if (obj.isFalling())
            obj.fall();
        else
            obj.run(obj);
    }

    fall()
    {
        if (this.moveDirection === directions.LEFT)
            this.imageName = "hero_falls_left";
        else
            this.imageName = "hero_falls_right";
    }

    run(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "hero_runs_left";
        else if (obj.moveDirection === directions.RIGHT)
            obj.imageName = "hero_runs_right";
    }

    shooting()
    {
        if (this.moveDirection === directions.LEFT)
            this.imageName = "hero_shoots_left";
        else if (this.moveDirection === directions.RIGHT)
            this.imageName = "hero_shoots_right";
    }

    move(dx, dy)
    {
        super.move(dx, dy);

        if (this.y === 0 && this.numberOfItems === control.gameState.grabedItems)
            control.gameState.loadNextLevel();
    }

    grabItem()
    {
        if (super.grabItem())
        {
            this.numberOfItems++;
            control.gameState.score += SCORE_PER_GOLD;
        }

        if (this.numberOfItems === control.gameState.grabedItems)
        {
            control.gameState.makeLadderVisible();
        }
    }

    shoot()
    {
        let behind = control.gameState.getBehind(this.x, this.y);

        if (this.isFalling() || behind.isGrabable() || behind.isClimbable())
            return;

        let target = null;

        if (this.moveDirection === directions.RIGHT)
            target = control.gameState.get(this.x + 1, this.y + 1);
        else
            target = control.gameState.get(this.x - 1, this.y + 1);

        let aboveTarget = control.gameState.get(target.x, target.y - 1);
        if (target.isBreakable() && !aboveTarget.isBoundary() && !target.isBroken())
        {
            target.setBroken(true);
            this.tryToMove(this.x - target.x, 0);
            this.shooting();
            this.updateImg();
            setTimeout(function ()
            {
                hero.run(hero);
                hero.updateImg();
            }, HERO_SHOOT_ANIM);
        }
    }

    animation()
    {
        super.animation();

        let k = control.gameState.getKey();

        if (k == ' ')
        {
            this.shoot();
            //alert('SHOOT');
            return;
        }
        else
            if (k != null)
            {
                let[dx, dy] = k;

                this.move(dx, dy);
            }
    }

    // getPos (){
    //     return [this.x, this.y];
    // }
}

// class Respawnable extends PassiveActor
// {
//     constructor(x, y, image)
//     {
//         super(x, y, image);
//         this.timeOfBreak = -1;
//         this.respawnTime = respawnTime;
//     }
// }

class Robot extends ActiveActor
{
    constructor(x, y)
    {
        super(x, y, "robot_runs_right");
        this.dx = 1;
        this.dy = 0;

        this.timeOfStun = -1;
        this.respawnTime = RESPAWN_TIME_ROBOT;
        this.dumbTime = false;

        this.stunned = false;

        this.climbingAnimation = new Animation(["robot_on_ladder_left", "robot_on_ladder_right"]);
    }

    climb(obj)
    {
        obj.imageName = obj.climbingAnimation.step();
    }

    lclimb(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "robot_runs_left";
        else
            obj.imageName = "robot_runs_right";
    }

    grab(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "robot_on_rope_left";
        else
            obj.imageName = "robot_on_rope_right";

    }

    lgrab(obj)
    {
        if (obj.isFalling())
            obj.fall();
        else
            obj.run(obj);
    }

    fall()
    {
        if (this.moveDirection === directions.LEFT)
            this.imageName = "robot_falls_left";
        else
            this.imageName = "robot_falls_right";
    }

    run(obj)
    {
        if (obj.moveDirection === directions.LEFT)
            obj.imageName = "robot_runs_left";
        else if (obj.moveDirection === directions.RIGHT)
            obj.imageName = "robot_runs_right";
    }

    animation()
    {

        if (!this.stunned)
        {
            let current = control.gameState.getBehind(this.x, this.y);

            if (current.isBreakable() && current.isBroken())
            {
                this.timeOfStun = this.time;
                this.stun();
                return;
            }
            super.animation();
        }

        if (!this.dumbTime && this.stunned && (this.time - this.timeOfStun > this.respawnTime))
        {
            setTimeout((function (robot)
                {
                    return function ()
                    {
                        robot.stunned = false;
                        robot.timeOfStun = -1;
                        robot.dumbTime = false;
                    }
                }
                )(this), ROBOT_DUMB_ANIM);

            this.dumbTime = true;

            this.stunned = false;
            this.timeOfStun = -1;

            let mov = (hero.x - this.x);
            this.update(mov < -1 ? -1 : 1, -1); // avoid falling in same hole again

        }

        this.decideMovement(hero.x, hero.y);
    }

    decideMovement(x, y)
    {
        if (this.stunned || this.dumbTime || this.time % 5 != 0)
            return;

        let oldCoords = [this.x, this.y];

        if (this.y > y)
            this.move(0, -1);
        else if (this.y < y)
            this.move(0, 1);

        let newCoords = [this.x, this.y];

        if (oldCoords != newCoords)
        {
            if (this.x > x)
                this.move(-1, 0);
            else if (this.x < x)
                this.move(1, 0);
        }
    }

    stun()
    {
        this.stunned = true;
    }

    isFellable()
    {
        return !this.stunned;
    }
}

class Breakable extends PassiveActor
{
    constructor(x, y, img, respawnTime)
    {
        super(x, y, img);
        this.image = img;
        this.broken = false;
        this.timeOfBreak = -1;
        this.respawnTime = respawnTime;
    }
    setBroken(boolVal)
    {
        this.broken = boolVal;
        this.timeOfBreak = this.time;
        if (boolVal)
            this.imageName = "empty";
        else
            this.imageName = this.image;
        this.show();
    }

    isFellable()
    {
        return this.broken;
    }
    isBroken()
    {
        return this.broken;
    }
    isBoundary()
    {
        return !this.broken;
    }
    isBreakable()
    {
        return true;
    }
    isEmpty()
    {
        return this.broken;
    }
    animation()
    {
        if (this.broken && (this.time - this.timeOfBreak > this.respawnTime))
        {
            let inSamePos = control.gameState.get(this.x, this.y);
            if (inSamePos instanceof ActiveActor)
                inSamePos.die();
            this.setBroken(false);
            this.timeOfBreak = -1;
        }
    }

}

class Brick extends Breakable
{
    constructor(x, y)
    {
        super(x, y, "brick", RESPAWN_TIME_BRICK);
    }
}

class Chimney extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "chimney");
    }

    isFellable()
    {
        return true;
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

    isFellable()
    {
        return true;
    }
    isEmpty()
    {
        return true;
    }
}

class Gold extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "gold");
    }
    isItem()
    {
        return true;
    }
    isFellable()
    {
        return true;
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
        this.visiblility = false;
    }

    makeVisible()
    {
        this.visiblility = true;
        this.imageName = "ladder";
        this.show();
    }

    isVisible()
    {
        return this.visiblility;
    }

    isClimbable()
    {
        return true;
    }
}

class Rope extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "rope");
    }
    isGrabable()
    {
        return true;
    }

    isFellable()
    {
        return true;
    }
}

class Stone extends PassiveActor
{
    constructor(x, y)
    {
        super(x, y, "stone");
    }
    isBoundary()
    {
        return true;
    }
}

class BoundaryStone extends Stone
{
    constructor()
    {
        super(-1, -1);
    }
    show() {}
    hide() {}
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

class GameState extends State
{

    constructor()
    {
        super();
    }

    isInside(x, y)
    {
        return (x >= 0 && x < WORLD_WIDTH && y >= 0 && y < WORLD_HEIGHT)
    }

    get(x, y)
    {
        let aux = this.getBehind(x, y);
        if (aux !== this.boundaryStone && control.gameState.worldActive[x][y] !== empty)
        {
            return control.gameState.worldActive[x][y];
        }
        else
            return aux;
    }

    getValue()
    {
        control.gameState.invisibleLadder = [];
        let value = 0;
        for (let i = 0; i < WORLD_WIDTH; i++)
        {
            for (let j = 0; j < WORLD_HEIGHT; j++)
            {
                if (control.gameState.world[i][j].isItem())
                    value++;
                if (!control.gameState.world[i][j].isVisible())
                    this.storeCoordinates(i, j, control.gameState.invisibleLadder);
            }
        }
        return value;
    }

    storeCoordinates(xVal, yVal, array)
    {
        array.push(
        {
            x: xVal,
            y: yVal
        }
        );
    }

    makeLadderVisible()
    {
        let array = control.gameState.invisibleLadder;
        for (let i = 0; i < array.length; i++)
        {
            control.gameState.world[array[i].x][array[i].y].makeVisible();
        }
    }

    getBehind(x, y)
    {
        if (!this.isInside(x, y))
            return this.boundaryStone;

        return control.gameState.world[x][y];
    }

    loadNextLevel()
    {
        if (control.gameState.currentLevel < MAPS.length)
        {
            control.clearCanvas();
            control.gameState.currentLevel++;
            control.gameState.loadLevel(control.gameState.currentLevel);
        }
        control.gameState.grabedItems = control.gameState.getValue(); //atualiza o total de ouro daquele nivel
    }

    loadPreviousLevel()
    {
        if (control.gameState.currentLevel > 1)
        {
            control.clearCanvas();
            control.gameState.currentLevel--;
            control.gameState.loadLevel(control.gameState.currentLevel);
        }
    }

    reloadLevel()
    {
        control.clearCanvas();
        control.gameState.loadLevel(control.gameState.currentLevel);
    }

    loadEvents()
    {
        addEventListener("keydown", this.keyDownEvent, false);
        addEventListener("keyup", this.keyUpEvent, false);

        this.interval = setInterval(this.animationEvent, 1000 / ANIMATION_EVENTS_PER_SECOND);

        document.getElementById("nextLevelBtn").addEventListener("click", this.loadNextLevel, false);
        document.getElementById("prevLevelBtn").addEventListener("click", this.loadPreviousLevel, false);
        document.getElementById("reloadLevelBtn").addEventListener("click", this.reloadLevel, false);
        document.getElementById("nextLevelBtn").style.display = "block";
        document.getElementById("prevLevelBtn").style.display = "block";
        document.getElementById("reloadLevelBtn").style.display = "block";
    }

    unloadEvents()
    {
        removeEventListener("keydown", this.keyDownEvent, false);
        removeaddEventListener("keyup", this.keyUpEvent, false);
        clearInterval(this.interval);

        document.getElementById("nextLevelBtn").removeEventListener("click", this.loadNextLevel, false);
        document.getElementById("nextLevelBtn").removeEventListener("click", this.loadPreviousLevel, false);
        document.getElementById("reloadLevelBtn").removeEventListener("click", this.reloadLevel, false);
        document.getElementById("nextLevelBtn").style.display = "none";
        document.getElementById("prevLevelBtn").style.display = "none";
        document.getElementById("reloadLevelBtn").style.display = "none";
    }

    onCreate()
    {
        this.boundaryStone = new BoundaryStone();

        this.key = 0;
        this.score = 0;

        this.time = 0;

        empty = new Empty(); // only one empty actor needed

        this.world = this.createMatrix();
        this.worldActive = this.createMatrix();

        this.currentLevel = 1;
        this.reloadLevel();

        this.invisibleLadder = [];
        this.grabedItems = this.getValue();
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
        this.world = this.createMatrix();
        this.worldActive = this.createMatrix();

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
        case 32:
            return " ";
        default:
            return null;
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
                let b = control.gameState.world[x][y];

                if (a.time < control.gameState.time)
                {
                    a.time = control.gameState.time;
                    a.animation();
                }
                if (b.time < control.gameState.time)
                {
                    b.time = control.gameState.time;
                    b.animation();
                }
            }
    }

    keyDownEvent(k)
    {
        control.gameState.key = k.keyCode;
    }

    keyUpEvent(k) {}
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
