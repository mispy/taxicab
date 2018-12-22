import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, action, computed, autorun, reaction, IReactionDisposer} from 'mobx'
import {observer} from 'mobx-react'
import * as _ from 'lodash'
declare var require: any
const TinyQueue = require('tinyqueue').default

import './index.scss'

// A region's erosion level is its geologic index plus the cave system's depth, all modulo 20183. Then:

// If the erosion level modulo 3 is 0, the region's type is rocky.
// If the erosion level modulo 3 is 1, the region's type is wet.
// If the erosion level modulo 3 is 2, the region's type is narrow.

const ROCKY = '.'
const WET = '='
const NARROW = '|'

const TORCH = 'torch'
const CLIMB = 'climb'
const NEITHER = 'neither'

interface Point {
    x: number
    y: number
}

interface Region {
    x: number
    y: number
    type: string
}

function riskLevel(region: Region): number {
    if (region.type === ROCKY)
        return 0
    else if (region.type === WET)
        return 1
    else if (region.type === NARROW)
        return 2  
    else
        throw new Error()
}

class Cave {
    depth: number
    goalPos: Point
    startPos: Point = { x: 0, y: 0 }
    width: number
    height: number

    erosion: number[][] = []
    regions: Region[][] = []

    static fromPuzzle(input: string) {
        const lines = input.trim().split("\n").map(l => l.trim())
        const depth = parseInt(lines[0].split(" ")[1])
        const goal = lines[1].split(" ")[1]
        const [tx, ty] = goal.split(",").map(s => parseInt(s))
        console.log(tx, ty)
        return new Cave(depth, tx, ty)
    }

    constructor(depth: number, goalX: number, goalY: number) {
        this.depth = depth
        this.goalPos = { x: goalX, y: goalY }
        this.width = goalX+1
        this.height = goalY+1

        for (let y of _.range(this.height)) {
            this.erosion[y] = []
            for (let x of _.range(this.width)) {
                this.erosion[y][x] = this.erosionLevel({x, y})    
            }
        }

        for (let y of _.range(this.height)) {
            this.regions[y] = []
            for (let x of _.range(this.width)) {
                this.regions[y][x] = { x, y, type: this.regionType({x, y}) }
            }
        }        
    }

    get startRegion() {
        return this.regions[this.startPos.y][this.startPos.x]
    }

    get goalRegion() {
        return this.regions[this.goalPos.y][this.goalPos.x]
    }

    geoIndex(p: Point) {
        // The region at 0,0 (the mouth of the cave) has a geologic index of 0.
        // The region at the coordinates of the goal has a geologic index of 0.
        // If the region's Y coordinate is 0, the geologic index is its X coordinate times 16807.
        // If the region's X coordinate is 0, the geologic index is its Y coordinate times 48271.
        // Otherwise, the region's geologic index is the result of multiplying the erosion levels of the regions at X-1,Y and X,Y-1.        
    
        const {goalPos} = this
        if (p.x=== 0 && p.y === 0)
            return 0
        else if (p.x === goalPos.x && p.y === goalPos.y)
            return 0
        else if (p.y === 0)
            return p.x*16807
        else if (p.x === 0)
            return p.y*48271
        else
            return this.erosion[p.y][p.x-1] * this.erosion[p.y-1][p.x]
    }

    erosionLevel(p: Point) {
        return (this.geoIndex(p) + this.depth) % 20183
    }

    regionType(p: Point): string {
        const mod = this.erosionLevel(p) % 3
        if (mod === 0)
            return ROCKY
        else if (mod === 1)
            return WET
        else// if (mod === 2)
            return NARROW
    }

    getChar(reg: Region) {
        if (reg == this.startRegion)
            return "M"
        else if (reg === this.goalRegion)
            return "T"
        else
            return reg.type
    }

    neighbors(reg: Region) {
        const {x, y} = reg
        const positions = [
            {x: x, y: y-1}, {x: x-1, y: y},
            {x: x+1, y: y}, {x: x, y: y+1}
        ]

        return positions.filter(p => p.x >= 0 && p.y >= 0 && p.x < this.width && p.y < this.height).map(p => this.regions[p.y][p.x])
    }
}

@observer
class AutoScaler extends React.Component<{ children: any }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()
    innerDiv: React.RefObject<HTMLDivElement> = React.createRef()

    @observable gridString: string = ""

    @observable xScale: number = 1
    @observable yScale: number = 1
    @observable translateX: number = 0
    @observable translateY: number = 0

    @action.bound onResize() {
        const goalRect = this.base.current!.getBoundingClientRect()
        const currentRect = this.innerDiv.current!.getBoundingClientRect()
        if (currentRect.width > 0 && currentRect.height > 0) {
            this.xScale = goalRect.width/(currentRect.width/this.xScale)
            this.yScale = goalRect.height/(currentRect.height/this.yScale)    
        }
    }

    componentDidMount() {
        this.onResize()
        window.addEventListener('resize', this.onResize)
    }

    componentDidUpdate() {
        this.onResize()
    }

    @computed get transform(): string {
        return `scale(${this.xScale}, ${this.yScale})`
    }

    render() {
        return <div ref={this.base} className="StringView">
            <code ref={this.innerDiv} style={{ transform: this.transform }}>
                {this.props.children}
            </code>
        </div>
    }
}

@observer
class FindRiskView extends React.Component<{ cave: Cave, index: number }> {
    render() {
        const {cave, index} = this.props

        let i = 0
        return <AutoScaler>
            {_.range(cave.height).map(y => 
                _.range(cave.width).map(x => {
                    i += 1

                    const reg = cave.regions[y][x]

                    if (i-1 <= index)
                        return <span className="riskRegion">{reg.type}</span>

                    if (reg === cave.startRegion)
                        return <span className="startRegion">{reg.type}</span>
                    else if (reg === cave.goalRegion)
                        return <span className="goalRegion">{reg.type}</span>
                    else
                        return reg.type
                }).concat([<br/>])
            )}
        </AutoScaler>
    }
}

@observer
class FindPathView extends React.Component<{ cave: Cave, seenRegions: Map<Region, boolean> }> {
    render() {
        const {cave, seenRegions} = this.props

        return <AutoScaler>
            {_.range(cave.height).map(y => 
                _.range(cave.width).map(x => {
                    const reg = cave.regions[y][x]

                    if (seenRegions.get(reg))
                        return <span className="pathRegion">{reg.type}</span>

                    if (reg === cave.startRegion)
                        return <span className="startRegion">{reg.type}</span>
                    else if (reg === cave.goalRegion)
                        return <span className="goalRegion">{reg.type}</span>
                    else
                        return reg.type
                }).concat([<br/>])
            )}
        </AutoScaler>
    }
}

export class PriorityQueue<T> {
    queue: any
    constructor() {
        this.queue = new TinyQueue([], (a: any, b: any) => a.priority - b.priority)
    }

    push(value: T, priority: number) {
        this.queue.push({ value, priority })
    }

    pop(): T {
        return this.queue.pop().value
    }

    get length(): number {
        return this.queue.length
    }
}

interface Pathcell {
    region: Region
    tool: string
}

class Pathfinder {
    cave: Cave
    start: Pathcell
    goal: Pathcell

    pathcells: {[key: string]: Pathcell} = {}
    frontier: PriorityQueue<Pathcell> = new PriorityQueue<Pathcell>()
    cameFrom: Map<Pathcell, Pathcell> = new Map()
    costSoFar: Map<Pathcell, number> = new Map()

    constructor(cave: Cave) {
        this.cave = cave
        this.start = this.getCell(cave.startRegion, TORCH)
        this.goal = this.getCell(cave.goalRegion, TORCH)
        this.frontier.push(this.start, 0)
        this.costSoFar.set(this.start, 0)
    }

    getCell(region: Region, tool: string) {
        const key = `${region.x},${region.y},${tool}`
        let cell = this.pathcells[key]
        if (cell)
            return cell
        else {
            cell = { region, tool }
            this.pathcells[key] = cell
            return cell
        }
    }

    nextCell() {
        const {cave, goal, frontier, cameFrom, costSoFar} = this

        if (frontier.length === 0)
            return null

        const current = frontier.pop()

        if (current === goal) {
            return null
        }

        const neighbors = cave.neighbors(current.region)
        const opts = []
        for (const n of neighbors) {
            const cur = current.region.type
            const ch = n.type 
            const tool = current.tool

            if (n === goal.region) {
                opts.push({ cell: this.getCell(n, TORCH), cost: tool !== TORCH ? 8 : 1 })
            } else {
                if (ch === ROCKY) {
                    if (cur !== NARROW) opts.push({ cell: this.getCell(n, CLIMB), cost: tool !== CLIMB ? 8 : 1 })
                    if (cur !== WET) opts.push({ cell: this.getCell(n, TORCH), cost: tool !== TORCH ? 8 : 1 })
                } else if (ch === WET) {
                    if (cur !== NARROW) opts.push({ cell: this.getCell(n, CLIMB), cost: tool !== CLIMB ? 8 : 1 })
                    if (cur !== ROCKY) opts.push({ cell: this.getCell(n, NEITHER), cost: tool !== NEITHER ? 8 : 1 })
                } else if (ch === NARROW) {
                    if (cur !== WET) opts.push({ cell: this.getCell(n, TORCH), cost: tool !== TORCH ? 8 : 1 })
                    if (cur !== ROCKY) opts.push({ cell: this.getCell(n, NEITHER), cost: tool !== NEITHER ? 8 : 1 })
                }
            }
        }

        for (const opt of opts) {    
            // We now record the cost to reach this cell, if it is the shortest
            // cost for a path we have yet found
            const newCost = (costSoFar.get(current)||0) + opt.cost
            const prevCost = costSoFar.get(opt.cell)

            if (prevCost === undefined || newCost < prevCost) {
                costSoFar.set(opt.cell, newCost)
                frontier.push(opt.cell, newCost)
                cameFrom.set(opt.cell, current)
            }
        }

        return current
    }
}

@observer
class Main extends React.Component {
    @observable puzzleInput = `depth: 510\ngoal: 10,10\n`
    @observable cave: Cave = Cave.fromPuzzle(this.puzzleInput)

    @observable findRiskIndex: number = -1
    @observable risk: number = 0

    pathfinder?: Pathfinder
    @observable seenRegions: Map<Region, boolean> = new Map()
    
    @action.bound onPuzzleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
        this.puzzleInput = e.currentTarget.value
    }

    @action.bound readPuzzle(input: string) {
        this.cave = Cave.fromPuzzle(input)
    }

    @action.bound onFindRisk() {
        this.findRiskIndex = 0
        this.findRiskFrame()
    }

    @action.bound findRiskFrame() {
        this.findRiskIndex += 1

        if (this.findRiskIndex >= this.cave.width*this.cave.height)
            this.findRiskIndex = -1
        else {

            const y = Math.floor(this.findRiskIndex / this.cave.height)
            const x = this.findRiskIndex % this.cave.height

            this.risk += riskLevel(this.cave.regions[y][x])

            requestAnimationFrame(this.findRiskFrame)
        }
    }

    @action.bound onFindPath() {
        this.pathfinder = new Pathfinder(this.cave)
        this.seenRegions = new Map()
        this.findPathFrame()
    }

    @action.bound findPathFrame() {
        const cell = this.pathfinder!.nextCell()

        if (cell === null) {
            // Finished
            this.pathfinder = undefined
        } else {
            this.seenRegions.set(cell.region, true)
            this.forceUpdate()
            requestAnimationFrame(this.findPathFrame)
        }
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = autorun(() => this.readPuzzle(this.puzzleInput))
    }

    componentWillUnmount() {
        this.dispose()
    }

    render() {
        return <main>
            {!this.pathfinder && <FindRiskView cave={this.cave} index={this.findRiskIndex}/>}
            {this.pathfinder && <FindPathView cave={this.cave} seenRegions={this.seenRegions}/>}
            <textarea value={this.puzzleInput} onChange={this.onPuzzleInput}/>
            <div>
                <button onClick={this.onFindRisk}>Find risk level</button>
                <button onClick={this.onFindPath}>Find shortest path</button>
            </div>
            {this.findRiskIndex >= 0 && <div>{this.risk}</div>}
        </main>
    }
}

ReactDOM.render(<Main/>, document.getElementById("root"))